/**
 * key-name-map.ts
 *
 * Single source of truth for all keyboard key name mappings.
 *
 * Three mappings:
 *   1. jsKeyToXkb()  — JS event.key → XKB key name (for capture)
 *   2. xkbToDisplay() — XKB key name → friendly display label (for UI)
 *   3. MODIFIER_KEYS — keys that are modifier-only and never a bare key
 *
 * Previously duplicated across:
 *   - KeybindingsPanel.tsx (normalizeKeyName, friendlyKey)
 *   - BindingFormDialog.tsx (KEY_TO_XKB, toXkbKey)
 *   - @tanstack/react-hotkeys (formatForDisplay)
 */

// ── Modifier keys that should never be treated as the "key" part ──

const MODIFIER_KEYS = new Set([
  "Control",
  "Alt",
  "Shift",
  "Meta",
  "Super_L",
  "Super_R",
  "Hyper_L",
  "Hyper_R",
  "CapsLock",
  "NumLock",
  "ScrollLock",
]);

// ── JS event.key → XKB key name ──

const JS_TO_XKB: Record<string, string> = {
  // Navigation / editing
  Enter: "Return",
  " ": "space",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ArrowUp: "Up",
  ArrowDown: "Down",
  Escape: "Escape",
  Backspace: "BackSpace",
  Delete: "Delete",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "Page_Up",
  PageDown: "Page_Down",
  Tab: "Tab",

  // Lock keys
  CapsLock: "Caps_Lock",
  NumLock: "Num_Lock",
  ScrollLock: "Scroll_Lock",

  // System
  PrintScreen: "Print",
  Pause: "Pause",
  Menu: "Menu",

  // Modifier labels that browsers report on the second press / release
  // (we map them so they're recognized as modifier keys but they're
  //  also in MODIFIER_KEYS above, so they'll be rejected by jsKeyToXkb)
  Super_L: "Super_L",
  Super_R: "Super_R",
  Meta: "Super_L",
  Alt: "Alt_L",
  Control: "Control_L",
  Shift: "Shift_L",
};

// ── XKB key name → friendly display label ──

const XKB_TO_DISPLAY: Record<string, string> = {
  " ": "Space",
  Return: "Enter",
  Escape: "Esc",
  BackSpace: "Bcksp",
  Delete: "Del",
  Print: "PrtSc",
  space: "Space",

  // Arrows
  Left: "←",
  Right: "→",
  Up: "↑",
  Down: "↓",

  // Symbols — show the actual symbol
  minus: "−",
  equal: "=",
  bracketleft: "[",
  bracketright: "]",
  semicolon: ";",
  apostrophe: "'",
  comma: ",",
  period: ".",
  slash: "/",
  backslash: "\\",
  grave: "`",
};

// ── Public API ──

/**
 * Convert a JS event.key to an XKB key name.
 * Returns `null` for modifier-only keys (Control, Alt, Shift, Meta, etc.).
 *
 * Single uppercase letters (A-Z) are lowercased (XKB convention).
 * Known mappings use the lookup table. Everything else passes through.
 */
export function jsKeyToXkb(jsKey: string): string | null {
  if (MODIFIER_KEYS.has(jsKey)) return null;

  const mapped = JS_TO_XKB[jsKey];
  if (mapped) return mapped;

  // Single uppercase letter → lowercase (XKB convention: "a" not "A")
  if (jsKey.length === 1) return jsKey.toLowerCase();

  return jsKey;
}

/**
 * Convert an XKB key name to a friendly display label.
 *
 * Single lowercase letters are uppercased for display.
 * Everything else uses the lookup table or passes through.
 */
export function xkbToDisplay(xkbKey: string): string {
  const mapped = XKB_TO_DISPLAY[xkbKey];
  if (mapped) return mapped;

  // Single lowercase letter → uppercase for display
  if (xkbKey.length === 1) return xkbKey.toUpperCase();

  return xkbKey;
}
