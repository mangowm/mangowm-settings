import type { ConfigData } from "./config-types";
import type { SourceFile } from "./config-types";
import type { EntryId, KeybindEntry, KeybindFlags } from "./keybind-types";

/**
 * Deterministic hash of the fields that define a binding.
 * Same inputs → same id, across mounts / re-parses / file boundaries.
 */
export function makeEntryId(
  configKey: string,
  mode: string,
  mods: string,
  key: string,
  func: string,
  args: string,
): EntryId {
  let h = 5381;
  const s = `${configKey}|${mode}|${mods}|${key}|${func}|${args}`;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h = h & h;
  }
  return (h >>> 0).toString(36);
}

const BIND_KEY_RE = /^bind[slrp]*$/;

export function isBindKey(key: string): boolean {
  return BIND_KEY_RE.test(key);
}

// ── Merged ConfigData parsing (mode-less, for search engine) ──

export function parseKeybindings(data: ConfigData): KeybindEntry[] {
  const entries: KeybindEntry[] = [];
  const keys = Object.keys(data).filter(isBindKey).sort();

  for (const key of keys) {
    const values = data[key];
    for (let i = 0; i < values.length; i++) {
      const entry = parseSingleBinding(key, i, values[i]);
      if (entry) {
        entry.id = makeEntryId(entry.configKey, entry.mode, entry.mods, entry.key, entry.func, entry.args);
        entries.push(entry);
      }
    }
  }

  return entries;
}

// ── SourceFile parsing (mode-aware, for the panel) ──

export function parseKeybindingsFromFiles(files: SourceFile[]): KeybindEntry[] {
  const entries: KeybindEntry[] = [];
  let currentMode = "default";
  const globalIdx: Record<string, number> = {};

  for (const file of files) {
    // Per-file consumption counter for data[key] arrays.
    // Entry lines consume one value from data[key] in order.
    const consumed: Record<string, number> = {};

    for (const line of file.lines) {
      if (line.type !== "entry") continue;
      const { key } = line;

      if (key === "keymode") {
        const dataValues = file.data[key] ?? [];
        const localIdx = consumed[key] ?? 0;
        if (localIdx < dataValues.length) {
          currentMode = dataValues[localIdx];
          consumed[key] = localIdx + 1;
        }
        continue;
      }

      if (!isBindKey(key)) continue;

      const idx = globalIdx[key] ?? 0;
      const dataValues = file.data[key] ?? [];
      const localIdx = consumed[key] ?? 0;

      if (localIdx < dataValues.length) {
        const value = dataValues[localIdx];
        const entry = parseSingleBinding(key, idx, value);
        if (entry) {
          entry.mode = currentMode;
          entry.id = makeEntryId(entry.configKey, entry.mode, entry.mods, entry.key, entry.func, entry.args);
          entries.push(entry);
        }
        consumed[key] = localIdx + 1;
      }
      // If data is exhausted for this key, the line represents a
      // removed entry — skip it. The global index still increments
      // so that remaining entries keep their original global indices.
      globalIdx[key] = idx + 1;
    }

    // New entries added via addEntry have data values with no
    // corresponding lines — append them at the end.

    // First, consume any remaining keymode values that were added
    // via addEntry so currentMode is correct for the bindings below.
    const kmConsumed = consumed["keymode"] ?? 0;
    const kmValues = file.data["keymode"] ?? [];
    for (let i = kmConsumed; i < kmValues.length; i++) {
      currentMode = kmValues[i];
    }

    // Process remaining bind values now that currentMode is up to date.
    for (const key of Object.keys(file.data)) {
      if (!isBindKey(key)) continue;
      const dataValues = file.data[key] ?? [];
      let localIdx = consumed[key] ?? 0;
      while (localIdx < dataValues.length) {
        const idx = globalIdx[key] ?? 0;
        const entry = parseSingleBinding(key, idx, dataValues[localIdx]);
        if (entry) {
          entry.mode = currentMode;
          entry.id = makeEntryId(entry.configKey, entry.mode, entry.mods, entry.key, entry.func, entry.args);
          entries.push(entry);
        }
        globalIdx[key] = idx + 1;
        localIdx++;
      }
    }
  }

  return entries;
}

/**
 * Returns the effective mode at the end of all loaded files by reading
 * the last value from each file's data["keymode"] (which reflects
 * mutations from addEntry).
 *
 * This is the mode context that new bindings appended via addEntry will
 * inherit during the next re-parse.  Callers that need a different mode
 * MUST insert a `keymode=` line before adding the binding.
 */
export function getActiveModeAtEnd(files: SourceFile[]): string {
  let mode = "default";
  for (const file of files) {
    const modes = file.data["keymode"];
    if (modes && modes.length > 0) {
      mode = modes[modes.length - 1];
    } else {
      // Fallback: walk lines for pre-existing mode entries
      for (const line of file.lines) {
        if (line.type === "entry" && line.key === "keymode") {
          mode = line.value;
        }
      }
    }
  }
  return mode;
}

// ── Mode block boundary helpers ──────────────────────────────────────────────

import type { ConfigLine } from "./config-types";

/**
 * Find the index of the last `keymode=<mode>` line in `lines`.
 * If `mode` is omitted, finds the last `keymode=` line regardless of value.
 * Returns -1 if not found.
 */
export function findLastKeymodeLine(lines: ConfigLine[], mode?: string): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    const ln = lines[i];
    if (ln.type === "entry" && ln.key === "keymode") {
      if (mode === undefined || ln.value === mode) return i;
    }
  }
  return -1;
}

/**
 * Given the index of a `keymode=` line, return the index of the last line
 * that belongs to that mode block — i.e. the line just before the next
 * `keymode=` line, or the last line in the file.
 */
export function findBlockEnd(lines: ConfigLine[], keymodeIdx: number): number {
  for (let i = keymodeIdx + 1; i < lines.length; i++) {
    const ln = lines[i];
    if (ln.type === "entry" && ln.key === "keymode") {
      return i - 1;
    }
  }
  return lines.length - 1;
}

/**
 * Find the best place to insert a binding in `targetMode` so that it lands
 * in the correct mode block.  Returns `{ fileIdx, afterLineIdx }` or `null`
 * if the binding should simply be appended at the end.
 *
 * Rules:
 *   - If `targetMode === "default"` and there are `keymode=` lines in the
 *     file, insert before the very first `keymode=` (i.e. keep default
 *     bindings at the top).
 *   - If `targetMode` has an existing `keymode=` line, insert after the last
 *     entry in that block.
 *   - Otherwise return null (caller should append or create a new block).
 */
export function findInsertPosition(
  lines: ConfigLine[],
  fileIdx: number,
  targetMode: string,
): { fileIdx: number; afterLineIdx: number } | null {
  if (targetMode === "default") {
    // Default mode is implicit — no `keymode=default` line needed.
    // Insert before the first `keymode=` to keep default binds at the top.
    const firstKm = lines.findIndex(
      (ln): ln is ConfigLine & { type: "entry" } => ln.type === "entry" && ln.key === "keymode",
    );
    if (firstKm >= 0) {
      // Insert right before the first keymode line
      return { fileIdx, afterLineIdx: firstKm - 1 };
    }
    // No keymode lines at all — everything is default, append at end.
    return null;
  }

  // Non-default mode: find the last `keymode=<targetMode>` line
  const kmIdx = findLastKeymodeLine(lines, targetMode);
  if (kmIdx >= 0) {
    const blockEnd = findBlockEnd(lines, kmIdx);
    return { fileIdx, afterLineIdx: blockEnd };
  }

  // Mode block doesn't exist yet — caller should create it at end.
  return null;
}

// ── Single binding parse / serialize ──

export function parseSingleBinding(
  configKey: string,
  configIndex: number,
  value: string,
): KeybindEntry | null {
  const parts = value.split(",");
  if (parts.length < 3) return null;

  const entry: KeybindEntry = {
    id: "",  // re-computed by caller with actual mode
    configKey,
    configIndex,
    raw: value,
    mode: "default",
    mods: parts[0],
    key: parts[1],
    func: parts[2],
    args: parts.slice(3).join(","),
    flags: parseFlagsFromKey(configKey),
  };
  return entry;
}

export function serializeBindingEntry(entry: KeybindEntry): string {
  const parts = [entry.mods, entry.key, entry.func];
  if (entry.args) parts.push(entry.args);
  return parts.join(",");
}

// ── Flags ──

export function bindKeyFromFlags(flags: KeybindFlags): string {
  let key = "bind";
  if (flags.keysym) key += "s";
  if (flags.lock) key += "l";
  if (flags.release) key += "r";
  if (flags.pass) key += "p";
  return key;
}

export function parseFlagsFromKey(key: string): KeybindFlags {
  const suffix = key.startsWith("bind") ? key.slice(4) : "";
  return {
    keysym: suffix.includes("s"),
    lock: suffix.includes("l"),
    release: suffix.includes("r"),
    pass: suffix.includes("p"),
  };
}

// ── Modifiers ──

export function parseModifiers(modStr: string): string[] {
  if (!modStr || modStr.toLowerCase() === "none") return [];
  return modStr.split("+").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function serializeModifiers(mods: string[]): string {
  if (mods.length === 0) return "none";
  return mods.join("+");
}
