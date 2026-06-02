export type DispatcherCategory =
  | "window"
  | "navigation"
  | "tags"
  | "layout"
  | "system"
  | "floating";

export interface DispatcherInfo {
  name: string;
  category: DispatcherCategory;
  description: string;
}

export const MANGO_DISPATCHERS: DispatcherInfo[] = [
  // Window Management
  { name: "killclient", category: "window", description: "Close the focused window" },
  {
    name: "togglefloating",
    category: "window",
    description: "Toggle floating state of the focused window",
  },
  {
    name: "toggle_all_floating",
    category: "window",
    description: "Toggle floating state for all visible clients",
  },
  { name: "togglefullscreen", category: "window", description: "Toggle fullscreen mode" },
  {
    name: "togglefakefullscreen",
    category: "window",
    description: "Toggle fake fullscreen (window stays constrained to monitor)",
  },
  {
    name: "togglemaximizescreen",
    category: "window",
    description: "Maximize window while keeping decorations and status bar visible",
  },
  {
    name: "toggleglobal",
    category: "window",
    description: "Pin window to all tags (stick across tag switches)",
  },
  {
    name: "toggle_render_border",
    category: "window",
    description: "Toggle border rendering for the focused window",
  },
  { name: "centerwin", category: "window", description: "Center the floating window on screen" },
  { name: "minimized", category: "window", description: "Minimize window to scratchpad" },
  {
    name: "restore_minimized",
    category: "window",
    description: "Restore the most recently minimized window from scratchpad",
  },
  {
    name: "toggle_scratchpad",
    category: "window",
    description: "Toggle the global scratchpad window",
  },
  {
    name: "toggle_named_scratchpad",
    category: "window",
    description:
      "Toggle a named scratchpad — launches app if not running, otherwise shows/hides it",
  },

  // Focus & Movement
  {
    name: "focusdir",
    category: "navigation",
    description: "Focus the nearest window in a direction (left/right/up/down)",
  },
  {
    name: "focusstack",
    category: "navigation",
    description: "Cycle focus within the stacking order (next/prev)",
  },
  { name: "focuslast", category: "navigation", description: "Focus the previously active window" },
  {
    name: "focusid",
    category: "navigation",
    description: "Focus a specific window by its client ID",
  },
  {
    name: "exchange_client",
    category: "navigation",
    description: "Swap the focused window with its neighbour in a direction (left/right/up/down)",
  },
  {
    name: "exchange_stack_client",
    category: "navigation",
    description: "Exchange the focused window's position in the stacking order (next/prev)",
  },
  {
    name: "zoom",
    category: "navigation",
    description: "Swap the focused window with the master window",
  },

  // Tags & Monitors
  {
    name: "view",
    category: "tags",
    description:
      "Switch to a tag by number (1-9), mask (e.g. 1|3|5), or special values (-1=previous, 0=all). Optional synctag flag",
  },
  {
    name: "viewtoleft",
    category: "tags",
    description: "View the previous tag. Optional synctag flag (0/1) syncs across monitors",
  },
  {
    name: "viewtoright",
    category: "tags",
    description: "View the next tag. Optional synctag flag (0/1) syncs across monitors",
  },
  {
    name: "viewtoleft_have_client",
    category: "tags",
    description:
      "View the previous tag and focus a client if one is present. Optional synctag flag",
  },
  {
    name: "viewtoright_have_client",
    category: "tags",
    description: "View the next tag and focus a client if one is present. Optional synctag flag",
  },
  {
    name: "viewcrossmon",
    category: "tags",
    description: "View the specified tag on the specified monitor",
  },
  {
    name: "tag",
    category: "tags",
    description:
      "Move the focused window to a tag (1-9). Optional synctag flag (0/1) syncs across monitors",
  },
  {
    name: "tagsilent",
    category: "tags",
    description: "Move the focused window to a tag (1-9) without switching focus to it",
  },
  {
    name: "tagtoleft",
    category: "tags",
    description: "Move the focused window to the previous tag. Optional synctag flag",
  },
  {
    name: "tagtoright",
    category: "tags",
    description: "Move the focused window to the next tag. Optional synctag flag",
  },
  {
    name: "tagcrossmon",
    category: "tags",
    description: "Move the focused window to the specified tag on the specified monitor",
  },
  {
    name: "toggletag",
    category: "tags",
    description: "Toggle a tag (0-9) on the focused window — 0 means all tags",
  },
  {
    name: "toggleview",
    category: "tags",
    description: "Toggle a tag's visibility (1-9) in the current view",
  },
  {
    name: "comboview",
    category: "tags",
    description: "View multiple tags pressed simultaneously (combo-key style navigation)",
  },
  {
    name: "focusmon",
    category: "tags",
    description: "Focus a monitor by direction (left/right/up/down) or monitor spec string",
  },
  {
    name: "tagmon",
    category: "tags",
    description:
      "Move the focused window to a monitor by direction or monitor spec. Optional keeptag flag (0/1)",
  },

  // Layouts
  {
    name: "setlayout",
    category: "layout",
    description:
      "Switch to a specific layout by name (tile, scroller, grid, deck, monocle, center_tile, vertical_tile, vertical_scroller)",
  },
  { name: "switch_layout", category: "layout", description: "Cycle through available layouts" },
  {
    name: "incnmaster",
    category: "layout",
    description: "Increase or decrease the number of master windows (+1/-1)",
  },
  {
    name: "setmfact",
    category: "layout",
    description: "Increase or decrease the master area size ratio (e.g. +0.05)",
  },
  {
    name: "set_proportion",
    category: "layout",
    description: "Set the scroller layout window proportion (0.0–1.0)",
  },
  {
    name: "switch_proportion_preset",
    category: "layout",
    description: "Cycle through scroller proportion presets (next/prev)",
  },
  {
    name: "scroller_stack",
    category: "layout",
    description:
      "Move a window into or out of the scroller stack by direction (left/right/up/down)",
  },
  {
    name: "incgaps",
    category: "layout",
    description: "Adjust the gap size by a relative value (+/-N)",
  },
  { name: "togglegaps", category: "layout", description: "Toggle gaps on and off" },
  {
    name: "dwindle_toggle_split_direction",
    category: "layout",
    description: "Toggle the split direction in dwindle layout (manual split mode)",
  },
  {
    name: "dwindle_split_horizontal",
    category: "layout",
    description: "Set the split window direction to horizontal in dwindle layout",
  },
  {
    name: "dwindle_split_vertical",
    category: "layout",
    description: "Set the split window direction to vertical in dwindle layout",
  },

  // System
  {
    name: "spawn",
    category: "system",
    description: "Execute a command (args are joined with spaces)",
  },
  {
    name: "spawn_shell",
    category: "system",
    description: "Execute a shell command, supports pipes and shell operators (|, &&, ;)",
  },
  {
    name: "spawn_on_empty",
    category: "system",
    description: "Execute a command only if the specified tag (1-9) is empty",
  },
  {
    name: "reload_config",
    category: "system",
    description: "Hot-reload the configuration file at runtime",
  },
  { name: "quit", category: "system", description: "Exit mangowm" },
  {
    name: "toggleoverview",
    category: "system",
    description: "Toggle the overview/tab mode for window switching",
  },
  {
    name: "create_virtual_output",
    category: "system",
    description: "Create a headless virtual monitor (for VNC or Sunshine streaming)",
  },
  {
    name: "destroy_all_virtual_output",
    category: "system",
    description: "Destroy all headless virtual monitors",
  },
  {
    name: "toggleoverlay",
    category: "system",
    description: "Toggle the overlay state for the focused window (always-on-top layer)",
  },
  {
    name: "toggle_trackpad_enable",
    category: "system",
    description: "Toggle the trackpad on and off",
  },
  {
    name: "setkeymode",
    category: "system",
    description: "Switch the active keybinding mode (submap)",
  },
  {
    name: "switch_keyboard_layout",
    category: "system",
    description: "Switch the keyboard layout. Optional index (0, 1, 2…) selects a specific layout",
  },
  {
    name: "setoption",
    category: "system",
    description: "Temporarily set a configuration option at runtime (key,value)",
  },
  { name: "chvt", category: "system", description: "Switch to a virtual terminal by number" },
  {
    name: "disable_monitor",
    category: "system",
    description: "Power off / shutdown a monitor by monitor spec",
  },
  { name: "enable_monitor", category: "system", description: "Power on a monitor by monitor spec" },
  {
    name: "toggle_monitor",
    category: "system",
    description: "Toggle a monitor's power state by monitor spec",
  },

  // Floating Window Movement
  {
    name: "smartmovewin",
    category: "floating",
    description:
      "Move the floating window by the snap distance in a direction (left/right/up/down)",
  },
  {
    name: "smartresizewin",
    category: "floating",
    description:
      "Resize the floating window by the snap distance in a direction (left/right/up/down)",
  },
  {
    name: "movewin",
    category: "floating",
    description: "Move the floating window by an absolute or relative offset (+/-x,+/-y)",
  },
  {
    name: "resizewin",
    category: "floating",
    description: "Resize the window by an absolute or relative width/height (+/-w,+/-h)",
  },
  {
    name: "moveresize",
    category: "floating",
    description:
      "Initiate interactive mouse-driven move or resize (curmove/curresize). Used with mousebind",
  },
] as const;

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
