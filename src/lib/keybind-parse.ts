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
    for (const line of file.lines) {
      if (line.type !== "entry") continue;
      const { key, value } = line;

      if (key === "keymode") {
        currentMode = value;
        continue;
      }

      if (!isBindKey(key)) continue;

      const idx = globalIdx[key] ?? 0;
      const entry = parseSingleBinding(key, idx, value);
      if (entry) {
        entry.mode = currentMode;
        entries.push(entry);
      }
      globalIdx[key] = idx + 1;
    }
  }

  return entries;
}

export function getActiveModeAtEnd(files: SourceFile[]): string {
  let mode = "default";
  for (const file of files) {
    for (const line of file.lines) {
      if (line.type === "entry" && line.key === "keymode") {
        mode = line.value;
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
