import type { ConfigData } from "./config-types";
import type { SourceFile } from "./config-types";
import type { KeybindEntry, KeybindFlags } from "./keybind-types";

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
      if (entry) entries.push(entry);
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
    for (const key of Object.keys(file.data)) {
      if (!isBindKey(key)) continue;
      const dataValues = file.data[key] ?? [];
      let localIdx = consumed[key] ?? 0;
      while (localIdx < dataValues.length) {
        const idx = globalIdx[key] ?? 0;
        const entry = parseSingleBinding(key, idx, dataValues[localIdx]);
        if (entry) {
          entry.mode = currentMode;
          entries.push(entry);
        }
        globalIdx[key] = idx + 1;
        localIdx++;
      }
    }
  }

  return entries;
}

export function getActiveModeAtEnd(files: SourceFile[]): string {
  // Walk files in order; for each file, take the last value from
  // data["keymode"] (which reflects mutations). Fall back to lines
  // only if data["keymode"] is missing or empty.
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

// ── Single binding parse / serialize ──

export function parseSingleBinding(
  configKey: string,
  configIndex: number,
  value: string,
): KeybindEntry | null {
  const parts = value.split(",");
  if (parts.length < 3) return null;

  return {
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
