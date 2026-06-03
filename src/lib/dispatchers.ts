// ── Arg type system ──────────────────────────────────────────────────────────

export type ArgType =
  | "none"          // hidden — no input rendered
  | "direction"     // left / right / up / down
  | "circle-dir"    // next / prev
  | "int"           // signed integer (±N, also supports +/-prefix for inc/dec)
  | "uint"          // unsigned integer (0+)
  | "float"         // floating-point ratio
  | "string"        // free-form text
  | "command"       // shell command (single value, may contain spaces)
  | "layout"        // layout name — one of LAYOUT_NAMES
  | "monitor"       // monitor spec string
  | "tag"           // single tag 1–9
  | "tag-mask"      // one or more tags: "1" or "1|3|5"
  | "bool-flag"     // 0 or 1
  | "mouse-action"; // curmove / curresize

export interface DispatcherArg {
  /** Short internal key, e.g. "direction", "ratio", "command" */
  name: string;
  type: ArgType;
  label: string;
  description: string;
  /** Placeholder text for text / command inputs */
  placeholder?: string;
  /** Fixed options for select-type args (direction, layout, …) */
  options?: string[];
  /** Numeric constraints for int/float args */
  min?: number;
  max?: number;
  step?: number;
  /** When true the field is highlighted if empty on submit */
  required?: boolean;
}

// ── Shared option lists ──────────────────────────────────────────────────────

export const DIRECTION_OPTS = ["left", "right", "up", "down"] as const;
export const CIRCLE_DIR_OPTS = ["next", "prev"] as const;
export const LAYOUT_NAMES = [
  "tile",
  "scroller",
  "grid",
  "deck",
  "monocle",
  "center_tile",
  "vertical_tile",
  "vertical_scroller",
] as const;
export const MOUSE_ACTION_OPTS = ["curmove", "curresize"] as const;
export const TAG_NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
export const BOOL_FLAGS = ["0", "1"] as const;
export const DIR_LABELS: Record<string, string> = {
  left: "Left",
  right: "Right",
  up: "Up",
  down: "Down",
};
export const CIRCLE_DIR_LABELS: Record<string, string> = {
  next: "Next",
  prev: "Prev",
};
export const MOUSE_LABELS: Record<string, string> = {
  curmove: "Move",
  curresize: "Resize",
};
export const BOOL_LABELS: Record<string, string> = {
  "0": "Off",
  "1": "On",
};
export const TAG_LABELS: Record<string, string> = Object.fromEntries(
  TAG_NUMBERS.map((n) => [n, `Tag ${n}`]),
);

export type DispatcherCategory =
  | "window"
  | "navigation"
  | "tags"
  | "layout"
  | "system"
  | "floating"
  | "spawn";

export interface DispatcherInfo {
  name: string;
  category: DispatcherCategory;
  description: string;
  /** Ordered arg definitions. Empty array = no args. */
  args: DispatcherArg[];
}

// ── Helper: build a simple single-arg entry ──────────────────────────────────

function oneArg(
  type: ArgType,
  label: string,
  description: string,
  extra?: Partial<DispatcherArg>,
): DispatcherArg[] {
  return [{ name: type, type, label, description, ...extra }];
}

/** Like oneArg but with an explicit name (when name differs from type). */
function namedArg(
  name: string,
  type: ArgType,
  label: string,
  description: string,
  extra?: Partial<DispatcherArg>,
): DispatcherArg[] {
  return [{ name, type, label, description, ...extra }];
}

// ── Full dispatcher registry ─────────────────────────────────────────────────

export const MANGO_DISPATCHERS: DispatcherInfo[] = [
  // ── Window ───────────────────────────────────────────────────────────────
  { name: "killclient",     category: "window", args: [], description: "Close the focused window" },
  { name: "togglefloating", category: "window", args: [], description: "Toggle floating state of the focused window" },
  { name: "toggle_all_floating", category: "window", args: [], description: "Toggle floating state for all visible clients" },
  { name: "togglefullscreen", category: "window", args: [], description: "Toggle fullscreen mode" },
  { name: "togglefakefullscreen", category: "window", args: [], description: "Toggle fake fullscreen (window stays constrained to monitor)" },
  { name: "togglemaximizescreen", category: "window", args: [], description: "Maximize window while keeping decorations and status bar visible" },
  { name: "toggleglobal",   category: "window", args: [], description: "Pin window to all tags (stick across tag switches)" },
  { name: "toggle_render_border", category: "window", args: [], description: "Toggle border rendering for the focused window" },
  { name: "centerwin",      category: "window", args: [], description: "Center the floating window on screen" },
  { name: "minimized",      category: "window", args: [], description: "Minimize window to scratchpad" },
  { name: "restore_minimized", category: "window", args: [], description: "Restore the most recently minimized window from scratchpad" },
  { name: "toggle_scratchpad", category: "window", args: [], description: "Toggle the global scratchpad window" },
  {
    name: "toggle_named_scratchpad",
    category: "window",
    args: [
      { name: "id", type: "string", label: "Identifier", description: "Unique scratchpad ID", placeholder: "e.g. term-scratch", required: true },
      { name: "title", type: "string", label: "Window Title", description: "Match window by title (optional)", placeholder: "e.g. Terminal" },
      { name: "spawn", type: "command", label: "Fallback Command", description: "Launch this command if no window matches", placeholder: "e.g. foot" },
    ],
    description: "Toggle a named scratchpad — launches app if not running, otherwise shows/hides it",
  },

  // ── Navigation ───────────────────────────────────────────────────────────
  {
    name: "focusdir",
    category: "navigation",
    args: oneArg("direction", "Direction", "Nearest window in this direction", { options: [...DIRECTION_OPTS] }),
    description: "Focus the nearest window in a direction (left/right/up/down)",
  },
  {
    name: "focusstack",
    category: "navigation",
    args: oneArg("circle-dir", "Direction", "Cycle focus in stacking order", { options: [...CIRCLE_DIR_OPTS] }),
    description: "Cycle focus within the stacking order (next/prev)",
  },
  { name: "focuslast", category: "navigation", args: [], description: "Focus the previously active window" },
  { name: "focusid", category: "navigation", args: [], description: "Focus a specific window by its client ID" },
  {
    name: "exchange_client",
    category: "navigation",
    args: oneArg("direction", "Direction", "Swap with neighbour in this direction", { options: [...DIRECTION_OPTS] }),
    description: "Swap the focused window with its neighbour in a direction (left/right/up/down)",
  },
  {
    name: "exchange_stack_client",
    category: "navigation",
    args: oneArg("circle-dir", "Direction", "Move in stacking order", { options: [...CIRCLE_DIR_OPTS] }),
    description: "Exchange the focused window's position in the stacking order (next/prev)",
  },
  { name: "zoom", category: "navigation", args: [], description: "Swap the focused window with the master window" },

  // ── Tags & Monitors ──────────────────────────────────────────────────────
  {
    name: "view",
    category: "tags",
    args: [
      { name: "tag", type: "tag-mask", label: "Tag(s)", description: "Tag number (1-9), mask (1|3|5), -1 = previous, 0 = all", placeholder: "e.g. 1 or 1|3|5", required: true },
      { name: "synctag", type: "bool-flag", label: "Sync Across Monitors", description: "Apply to all monitors", options: [...BOOL_FLAGS] },
    ],
    description: "Switch to a tag by number (1-9), mask (e.g. 1|3|5), or special values (-1=previous, 0=all). Optional synctag flag",
  },
  {
    name: "viewtoleft",
    category: "tags",
    args: namedArg("synctag", "bool-flag", "Sync Across Monitors", "Apply to all monitors (0/1)", { options: [...BOOL_FLAGS] }),
    description: "View the previous tag. Optional synctag flag (0/1) syncs across monitors",
  },
  {
    name: "viewtoright",
    category: "tags",
    args: namedArg("synctag", "bool-flag", "Sync Across Monitors", "Apply to all monitors (0/1)", { options: [...BOOL_FLAGS] }),
    description: "View the next tag. Optional synctag flag (0/1) syncs across monitors",
  },
  {
    name: "viewtoleft_have_client",
    category: "tags",
    args: namedArg("synctag", "bool-flag", "Sync Across Monitors", "Apply to all monitors (0/1)", { options: [...BOOL_FLAGS] }),
    description: "View the previous tag and focus a client if one is present. Optional synctag flag",
  },
  {
    name: "viewtoright_have_client",
    category: "tags",
    args: namedArg("synctag", "bool-flag", "Sync Across Monitors", "Apply to all monitors (0/1)", { options: [...BOOL_FLAGS] }),
    description: "View the next tag and focus a client if one is present. Optional synctag flag",
  },
  {
    name: "viewcrossmon",
    category: "tags",
    args: [
      { name: "tag", type: "tag", label: "Tag", description: "Tag number (1-9)", options: [...TAG_NUMBERS], required: true },
      { name: "monitor", type: "monitor", label: "Monitor", description: "Monitor name (e.g. DP-1)", placeholder: "Monitor name" },
    ],
    description: "View the specified tag on the specified monitor",
  },
  {
    name: "tag",
    category: "tags",
    args: [
      { name: "tag", type: "tag", label: "Tag", description: "Tag number (1-9)", options: [...TAG_NUMBERS], required: true },
      { name: "synctag", type: "bool-flag", label: "Sync Across Monitors", description: "Apply to all monitors", options: [...BOOL_FLAGS] },
    ],
    description: "Move the focused window to a tag (1-9). Optional synctag flag (0/1) syncs across monitors",
  },
  {
    name: "tagsilent",
    category: "tags",
    args: namedArg("tag", "tag", "Tag", "Tag number (1-9)", { options: [...TAG_NUMBERS], required: true }),
    description: "Move the focused window to a tag (1-9) without switching focus to it",
  },
  {
    name: "tagtoleft",
    category: "tags",
    args: namedArg("synctag", "bool-flag", "Sync Across Monitors", "Apply to all monitors (0/1)", { options: [...BOOL_FLAGS] }),
    description: "Move the focused window to the previous tag. Optional synctag flag",
  },
  {
    name: "tagtoright",
    category: "tags",
    args: namedArg("synctag", "bool-flag", "Sync Across Monitors", "Apply to all monitors (0/1)", { options: [...BOOL_FLAGS] }),
    description: "Move the focused window to the next tag. Optional synctag flag",
  },
  {
    name: "tagcrossmon",
    category: "tags",
    args: [
      { name: "tag", type: "tag", label: "Tag", description: "Tag number (1-9)", options: [...TAG_NUMBERS], required: true },
      { name: "monitor", type: "monitor", label: "Monitor", description: "Monitor name (e.g. DP-1)", placeholder: "Monitor name" },
    ],
    description: "Move the focused window to the specified tag on the specified monitor",
  },
  {
    name: "toggletag",
    category: "tags",
    args: namedArg("tag", "tag", "Tag", "Tag to toggle (1-9, 0 = all)", { options: [...TAG_NUMBERS, "0"], required: true }),
    description: "Toggle a tag (0-9) on the focused window — 0 means all tags",
  },
  {
    name: "toggleview",
    category: "tags",
    args: namedArg("tag", "tag", "Tag", "Tag to toggle (1-9)", { options: [...TAG_NUMBERS], required: true }),
    description: "Toggle a tag's visibility (1-9) in the current view",
  },
  {
    name: "comboview",
    category: "tags",
    args: namedArg("tag", "tag", "Tag", "Combo-tag (1-9)", { options: [...TAG_NUMBERS], required: true }),
    description: "View multiple tags pressed simultaneously (combo-key style navigation)",
  },
  {
    name: "focusmon",
    category: "tags",
    args: [
      { name: "target", type: "direction", label: "Monitor", description: "Direction or monitor name (e.g. DP-1)", options: [...DIRECTION_OPTS] },
    ],
    description: "Focus a monitor by direction (left/right/up/down) or monitor spec string",
  },
  {
    name: "tagmon",
    category: "tags",
    args: [
      { name: "target", type: "direction", label: "Target Monitor", description: "Direction or monitor name", options: [...DIRECTION_OPTS] },
      { name: "keeptag", type: "bool-flag", label: "Keep Tag", description: "Keep window's current tag (0/1)", options: [...BOOL_FLAGS] },
    ],
    description: "Move the focused window to a monitor by direction or monitor spec. Optional keeptag flag (0/1)",
  },

  // ── Layout ───────────────────────────────────────────────────────────────
  {
    name: "setlayout",
    category: "layout",
    args: namedArg("layout", "layout", "Layout", "Target layout name", { options: [...LAYOUT_NAMES], required: true }),
    description: "Switch to a specific layout by name (tile, scroller, grid, deck, monocle, center_tile, vertical_tile, vertical_scroller)",
  },
  { name: "switch_layout", category: "layout", args: [], description: "Cycle through available layouts" },
  {
    name: "incnmaster",
    category: "layout",
    args: namedArg("delta", "int", "Delta", "Number of masters to add (+1) or remove (-1)", { placeholder: "+1", required: true }),
    description: "Increase or decrease the number of master windows (+1/-1)",
  },
  {
    name: "setmfact",
    category: "layout",
    args: namedArg("ratio", "float", "Ratio", "Master area ratio change (±0.05)", { min: -0.9, max: 0.9, step: 0.01, placeholder: "+0.05", required: true }),
    description: "Increase or decrease the master area size ratio (e.g. +0.05)",
  },
  {
    name: "set_proportion",
    category: "layout",
    args: namedArg("proportion", "float", "Proportion", "Window proportion (0.0–1.0)", { min: 0, max: 1, step: 0.01, placeholder: "0.5", required: true }),
    description: "Set the scroller layout window proportion (0.0–1.0)",
  },
  {
    name: "switch_proportion_preset",
    category: "layout",
    args: oneArg("circle-dir", "Direction", "Cycle through presets", { options: [...CIRCLE_DIR_OPTS] }),
    description: "Cycle through scroller proportion presets (next/prev)",
  },
  {
    name: "scroller_stack",
    category: "layout",
    args: oneArg("direction", "Direction", "Move window in scroller stack", { options: [...DIRECTION_OPTS] }),
    description: "Move a window into or out of the scroller stack by direction (left/right/up/down)",
  },
  {
    name: "incgaps",
    category: "layout",
    args: namedArg("delta", "int", "Delta", "Gap size delta (±N)", { placeholder: "+5", required: true }),
    description: "Adjust the gap size by a relative value (+/-N)",
  },
  { name: "togglegaps", category: "layout", args: [], description: "Toggle gaps on and off" },
  { name: "dwindle_toggle_split_direction", category: "layout", args: [], description: "Toggle the split direction in dwindle layout (manual split mode)" },
  { name: "dwindle_split_horizontal", category: "layout", args: [], description: "Set the split window direction to horizontal in dwindle layout" },
  { name: "dwindle_split_vertical", category: "layout", args: [], description: "Set the split window direction to vertical in dwindle layout" },

  // ── Spawn ────────────────────────────────────────────────────────────────
  {
    name: "spawn",
    category: "spawn",
    args: namedArg("command", "command", "Command", "Command to execute", { placeholder: "foot --class myclass", required: true }),
    description: "Execute a command (args are joined with spaces)",
  },
  {
    name: "spawn_shell",
    category: "spawn",
    args: namedArg("command", "command", "Command", "Shell command", { placeholder: "sh -c 'notify-send Hello'", required: true }),
    description: "Execute a shell command, supports pipes and shell operators (|, &&, ;)",
  },
  {
    name: "spawn_on_empty",
    category: "spawn",
    args: [
      { name: "command", type: "command", label: "Command", description: "Command to spawn", placeholder: "foot", required: true },
      { name: "tag", type: "tag", label: "Target Tag", description: "Only spawn if tag is empty (1-9)", options: [...TAG_NUMBERS], required: true },
    ],
    description: "Execute a command only if the specified tag (1-9) is empty",
  },

  // ── System ───────────────────────────────────────────────────────────────
  { name: "reload_config", category: "system", args: [], description: "Hot-reload the configuration file at runtime" },
  { name: "quit", category: "system", args: [], description: "Exit mangowm" },
  {
    name: "toggleoverview",
    category: "system",
    args: namedArg("tabmode", "bool-flag", "Tab Mode", "1 = tab overview, 0 = grid overview", { options: [...BOOL_FLAGS] }),
    description: "Toggle the overview/tab mode for window switching",
  },
  { name: "create_virtual_output", category: "system", args: [], description: "Create a headless virtual monitor (for VNC or Sunshine streaming)" },
  { name: "destroy_all_virtual_output", category: "system", args: [], description: "Destroy all headless virtual monitors" },
  { name: "toggleoverlay", category: "system", args: [], description: "Toggle the overlay state for the focused window (always-on-top layer)" },
  { name: "toggle_trackpad_enable", category: "system", args: [], description: "Toggle the trackpad on and off" },
  {
    name: "setkeymode",
    category: "system",
    args: namedArg("mode", "string", "Mode Name", "Target keybinding mode (submap)", { placeholder: "resize", required: true }),
    description: "Switch the active keybinding mode (submap)",
  },
  {
    name: "switch_keyboard_layout",
    category: "system",
    args: namedArg("index", "uint", "Layout Index", "Keyboard layout index (0, 1, 2…)", { min: 0, max: 100, placeholder: "0" }),
    description: "Switch the keyboard layout. Optional index (0, 1, 2…) selects a specific layout",
  },
  {
    name: "setoption",
    category: "system",
    args: [
      { name: "key", type: "string", label: "Option Key", description: "Config key to change", placeholder: "gappih", required: true },
      { name: "value", type: "string", label: "Value", description: "New value", placeholder: "10", required: true },
    ],
    description: "Temporarily set a configuration option at runtime (key, value)",
  },
  {
    name: "chvt",
    category: "system",
    args: namedArg("vt", "uint", "VT Number", "Virtual terminal number", { min: 1, max: 12, placeholder: "2", required: true }),
    description: "Switch to a virtual terminal by number",
  },
  {
    name: "disable_monitor",
    category: "system",
    args: namedArg("monitor", "monitor", "Monitor", "Monitor name (e.g. DP-1)", { placeholder: "e.g. DP-1", required: true }),
    description: "Power off / shutdown a monitor by monitor spec",
  },
  {
    name: "enable_monitor",
    category: "system",
    args: namedArg("monitor", "monitor", "Monitor", "Monitor name (e.g. DP-1)", { placeholder: "e.g. DP-1", required: true }),
    description: "Power on a monitor by monitor spec",
  },
  {
    name: "toggle_monitor",
    category: "system",
    args: namedArg("monitor", "monitor", "Monitor", "Monitor name (e.g. DP-1)", { placeholder: "e.g. DP-1", required: true }),
    description: "Toggle a monitor's power state by monitor spec",
  },

  // ── Floating ─────────────────────────────────────────────────────────────
  {
    name: "smartmovewin",
    category: "floating",
    args: oneArg("direction", "Direction", "Snap direction", { options: [...DIRECTION_OPTS] }),
    description: "Move the floating window by the snap distance in a direction (left/right/up/down)",
  },
  {
    name: "smartresizewin",
    category: "floating",
    args: oneArg("direction", "Direction", "Resize direction", { options: [...DIRECTION_OPTS] }),
    description: "Resize the floating window by the snap distance in a direction (left/right/up/down)",
  },
  {
    name: "movewin",
    category: "floating",
    args: [
      { name: "x-mode", type: "string", label: "X Mode", description: "Prefix: blank, +, or -", placeholder: "100 or +50 or -25", required: true },
      { name: "x-offset", type: "int", label: "X Offset", description: "Horizontal offset", placeholder: "0" },
      { name: "y-mode", type: "string", label: "Y Mode", description: "Prefix: blank, +, or -", placeholder: "100 or +50 or -25", required: true },
      { name: "y-offset", type: "int", label: "Y Offset", description: "Vertical offset", placeholder: "0" },
    ],
    description: "Move the floating window by an absolute or relative offset (+/-x,+/-y)",
  },
  {
    name: "resizewin",
    category: "floating",
    args: [
      { name: "w-mode", type: "string", label: "Width Mode", description: "Prefix: blank, +, or -", placeholder: "200 or +50 or -25", required: true },
      { name: "w-offset", type: "int", label: "Width", description: "Width change", placeholder: "0" },
      { name: "h-mode", type: "string", label: "Height Mode", description: "Prefix: blank, +, or -", placeholder: "200 or +50 or -25", required: true },
      { name: "h-offset", type: "int", label: "Height", description: "Height change", placeholder: "0" },
    ],
    description: "Resize the window by an absolute or relative width/height (+/-w,+/-h)",
  },
  {
    name: "moveresize",
    category: "floating",
    args: namedArg("action", "mouse-action", "Action", "Mouse action (curmove/curresize)", { options: [...MOUSE_ACTION_OPTS] }),
    description: "Initiate interactive mouse-driven move or resize (curmove/curresize). Used with mousebind",
  },
] as const;

// ── Derived index ────────────────────────────────────────────────────────────

export const DISPATCHER_MAP: ReadonlyMap<string, DispatcherInfo> = new Map(
  MANGO_DISPATCHERS.map((d) => [d.name, d]),
);

export function getDispatchersByCategory(): [DispatcherCategory, DispatcherInfo[]][] {
  const categories: DispatcherCategory[] = [
    "window",
    "navigation",
    "tags",
    "layout",
    "system",
    "floating",
  ];
  return categories.map((cat) => [cat, MANGO_DISPATCHERS.filter((d) => d.category === cat)]);
}

// ── Arg value helpers ────────────────────────────────────────────────────────

/** Split a comma-separated args string into named values per schema. */
export function parseArgValues(
  args: string,
  schema: DispatcherArg[],
): Record<string, string> {
  const parts = args ? args.split(",") : [];
  const values: Record<string, string> = {};
  schema.forEach((arg, i) => {
    values[arg.name] = i < parts.length ? parts[i] : "";
  });
  return values;
}

/** Join named arg values back into a comma-separated string per schema order. */
export function serializeArgValues(
  values: Record<string, string>,
  schema: DispatcherArg[],
): string {
  return schema.map((arg) => values[arg.name] ?? "").join(",");
}

/**
 * Simple per-arg validation. Returns a human-readable error string or null.
 * Only validates by type — semantics (e.g. whether a tag is occupied) are
 * left to the compositor.
 */
export function validateArgValue(
  value: string,
  arg: DispatcherArg,
): string | null {
  if (arg.required && !value) return `${arg.label} is required`;
  if (!value) return null;

  switch (arg.type) {
    case "direction":
      if (!DIRECTION_OPTS.includes(value as any))
        return "Must be left, right, up, or down";
      break;
    case "circle-dir":
      if (!CIRCLE_DIR_OPTS.includes(value as any))
        return "Must be next or prev";
      break;
    case "int":
      if (!/^-?\d+$/.test(value)) return "Must be an integer";
      break;
    case "uint":
      if (!/^\d+$/.test(value)) return "Must be a positive integer";
      break;
    case "float":
      if (isNaN(Number(value))) return "Must be a number";
      break;
    case "tag":
      if (!/^[1-9]$/.test(value)) return "Must be a tag number 1–9";
      break;
    case "tag-mask": {
      // Special values: -1 = previous, 0 = all
      if (value === "-1" || value === "0") break;
      if (!/^\d+(\|\d+)*$/.test(value))
        return "Use numbers separated by |, e.g. 1|3|5";
      const nums = value.split("|");
      if (nums.some((n) => !/^[1-9]$/.test(n)))
        return "Each tag must be 1–9";
      break;
    }
    case "bool-flag":
      if (value !== "0" && value !== "1") return "Must be 0 or 1";
      break;
    case "mouse-action":
      if (!MOUSE_ACTION_OPTS.includes(value as any))
        return "Must be curmove or curresize";
      break;
    case "layout":
      if (!LAYOUT_NAMES.includes(value as any))
        return `Must be one of: ${LAYOUT_NAMES.join(", ")}`;
      break;
  }
  return null;
}

/**
 * Validate all arg values at once. Returns a map of argName → error string
 * (emptied on success).
 */
export function validateAllArgs(
  values: Record<string, string>,
  schema: DispatcherArg[],
): Record<string, string | null> {
  const errors: Record<string, string | null> = {};
  for (const arg of schema) {
    const e = validateArgValue(values[arg.name] ?? "", arg);
    if (e) errors[arg.name] = e;
  }
  return errors;
}

/**
 * Human-readable label for an arg value given its type and the shared
 * label maps above. Falls back to the raw value when no label exists.
 */
export function formatArgValue(value: string, arg: DispatcherArg): string {
  if (!value) return "—";
  switch (arg.type) {
    case "direction":
      return DIR_LABELS[value] ?? value;
    case "circle-dir":
      return CIRCLE_DIR_LABELS[value] ?? value;
    case "bool-flag":
      return BOOL_LABELS[value] ?? value;
    case "mouse-action":
      return MOUSE_LABELS[value] ?? value;
    case "tag":
      return TAG_LABELS[value] ?? value;
    default:
      return value;
  }
}
