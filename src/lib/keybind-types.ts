export interface KeybindFlags {
  keysym: boolean;
  lock: boolean;
  release: boolean;
  pass: boolean;
}

export interface KeybindEntry {
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
