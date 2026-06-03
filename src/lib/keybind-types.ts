export interface KeybindFlags {
  keysym: boolean;
  lock: boolean;
  release: boolean;
  pass: boolean;
}

/** Deterministic content-hash of (configKey, mode, mods, key, func, args).
 *  Same values → same id. Used for stable React keys and conflict
 *  self-comparison across re-parses. */
export type EntryId = string;

export interface KeybindEntry {
  /** Stable identity — survives index shifts from insert/delete */
  id: EntryId;
  configKey: string;
  configIndex: number;
  raw: string;
  mode: string;
  mods: string;
  key: string;
  func: string;
  args: string;
  flags: KeybindFlags;
}
