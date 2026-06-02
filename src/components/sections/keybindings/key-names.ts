export interface KeyNameInfo {
  name: string;
  aliases?: string[];
}

export interface KeyGroup {
  label: string;
  keys: KeyNameInfo[];
}

export const KEY_GROUPS: KeyGroup[] = [
  {
    label: "Most Common",
    keys: [
      { name: "Return", aliases: ["Enter"] },
      { name: "Escape", aliases: ["Esc"] },
      { name: "Tab" },
      { name: "Space" },
      { name: "BackSpace", aliases: ["Backspace", "BS"] },
      { name: "Delete", aliases: ["Del"] },
    ],
  },
  {
    label: "Letters",
    keys: "abcdefghijklmnopqrstuvwxyz".split("").map((c) => ({ name: c })),
  },
  {
    label: "Numbers",
    keys: "0123456789".split("").map((c) => ({ name: c })),
  },
  {
    label: "Function Keys",
    keys: Array.from({ length: 24 }, (_, i) => ({
      name: `F${i + 1}`,
    })),
  },
  {
    label: "Navigation / Arrows",
    keys: [
      { name: "Up", aliases: ["ArrowUp"] },
      { name: "Down", aliases: ["ArrowDown"] },
      { name: "Left", aliases: ["ArrowLeft"] },
      { name: "Right", aliases: ["ArrowRight"] },
      { name: "Home" },
      { name: "End" },
      { name: "Page_Up", aliases: ["Prior", "PgUp"] },
      { name: "Page_Down", aliases: ["Next", "PgDn"] },
    ],
  },
  {
    label: "Editing",
    keys: [
      { name: "Insert", aliases: ["Ins"] },
      { name: "Print", aliases: ["PrtSc"] },
      { name: "Sys_Req" },
      { name: "Pause" },
      { name: "Break" },
      { name: "Menu", aliases: ["Application"] },
      { name: "Clear", aliases: ["Cancel"] },
    ],
  },
  {
    label: "Lock Keys",
    keys: [
      { name: "Caps_Lock", aliases: ["Caps"] },
      { name: "Num_Lock", aliases: ["Num"] },
      { name: "Scroll_Lock", aliases: ["Scroll"] },
    ],
  },
  {
    label: "Keypad",
    keys: [
      ...Array.from({ length: 10 }, (_, i) => ({ name: `KP_${i}` })),
      { name: "KP_Add", aliases: ["KP_Plus"] },
      { name: "KP_Subtract", aliases: ["KP_Minus"] },
      { name: "KP_Multiply", aliases: ["KP_Asterisk"] },
      { name: "KP_Divide", aliases: ["KP_Slash"] },
      { name: "KP_Enter" },
      { name: "KP_Decimal", aliases: ["KP_Period"] },
      { name: "KP_Equal" },
    ],
  },
  {
    label: "Symbols & Punctuation",
    keys: [
      { name: "grave", aliases: ["backtick", "`"] },
      { name: "minus", aliases: ["-"] },
      { name: "equal", aliases: ["="] },
      { name: "bracketleft", aliases: ["["] },
      { name: "bracketright", aliases: ["]"] },
      { name: "semicolon", aliases: [";"] },
      { name: "apostrophe", aliases: ["'"] },
      { name: "comma", aliases: [","] },
      { name: "period", aliases: ["."] },
      { name: "slash", aliases: ["/"] },
      { name: "backslash", aliases: ["\\"] },
      { name: "backquote", aliases: ["`"] },
    ],
  },
  {
    label: "Shifted Symbols",
    keys: [
      { name: "underscore", aliases: ["_"] },
      { name: "plus", aliases: ["+"] },
      { name: "braceleft", aliases: ["{"] },
      { name: "braceright", aliases: ["}"] },
      { name: "colon", aliases: [":"] },
      { name: "quotedbl", aliases: ['"'] },
      { name: "less", aliases: ["<"] },
      { name: "greater", aliases:[">"] },
      { name: "question", aliases: ["?"] },
      { name: "bar", aliases: ["|"] },
      { name: "asciitilde", aliases: ["~"] },
      { name: "exclam", aliases: ["!"] },
      { name: "at", aliases: ["@"] },
      { name: "numbersign", aliases: ["#"] },
      { name: "dollar", aliases: ["$"] },
      { name: "percent", aliases: ["%"] },
      { name: "asciicircum", aliases: ["^"] },
      { name: "ampersand", aliases: ["&"] },
      { name: "asterisk", aliases: ["*"] },
      { name: "parenleft", aliases: ["("] },
      { name: "parenright", aliases: [")"] },
    ],
  },
  {
    label: "Multimedia",
    keys: [
      { name: "XF86AudioRaiseVolume", aliases: ["VolumeUp"] },
      { name: "XF86AudioLowerVolume", aliases: ["VolumeDown"] },
      { name: "XF86AudioMute", aliases: ["Mute"] },
      { name: "XF86AudioPlay", aliases: ["Play"] },
      { name: "XF86AudioPause", aliases: ["Pause"] },
      { name: "XF86AudioStop", aliases: ["Stop"] },
      { name: "XF86AudioNext", aliases: ["NextTrack"] },
      { name: "XF86AudioPrev", aliases: ["PrevTrack"] },
      { name: "XF86MonBrightnessUp", aliases: ["BrightnessUp"] },
      { name: "XF86MonBrightnessDown", aliases: ["BrightnessDown"] },
      { name: "XF86PowerOff", aliases: ["Power"] },
      { name: "XF86Sleep", aliases: ["Sleep"] },
      { name: "XF86Search", aliases: ["Search"] },
      { name: "XF86Mail", aliases: ["Mail"] },
      { name: "XF86WWW", aliases: ["Browser"] },
      { name: "XF86Calculator", aliases: ["Calc"] },
      { name: "XF86Display", aliases: ["Display"] },
      { name: "XF86Eject", aliases: ["Eject"] },
      { name: "XF86Tools", aliases: ["Tools"] },
      { name: "XF86Launch1", aliases: ["Launch1"] },
      { name: "XF86Launch2", aliases: ["Launch2"] },
      { name: "XF86Launch3", aliases: ["Launch3"] },
      { name: "XF86Launch4", aliases: ["Launch4"] },
      { name: "XF86Launch5", aliases: ["Launch5"] },
      { name: "XF86Launch6", aliases: ["Launch6"] },
      { name: "XF86Launch7", aliases: ["Launch7"] },
      { name: "XF86Launch8", aliases: ["Launch8"] },
      { name: "XF86Launch9", aliases: ["Launch9"] },
      { name: "XF86Favorites", aliases: ["Favorites"] },
      { name: "XF86HomePage", aliases: ["HomePage"] },
      { name: "XF86MyComputer", aliases: ["MyComputer"] },
      { name: "XF86ScreenSaver", aliases: ["ScreenSaver"] },
    ],
  },
];

export function searchKeyNames(query: string): { name: string; groupLabel: string }[] {
  if (!query.trim()) return [];
  const lower = query.toLowerCase();
  const results: { name: string; groupLabel: string }[] = [];
  for (const group of KEY_GROUPS) {
    for (const key of group.keys) {
      if (
        key.name.toLowerCase().includes(lower) ||
        key.aliases?.some((a) => a.toLowerCase().includes(lower))
      ) {
        results.push({ name: key.name, groupLabel: group.label });
      }
    }
  }
  return results;
}
