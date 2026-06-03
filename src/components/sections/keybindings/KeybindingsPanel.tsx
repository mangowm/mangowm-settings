/**
 * KeybindingsPanel
 *
 * Merges HEAD's config-store data layer with the working tree's
 * inline key-recorder UI/UX.
 *
 * Data:  reads from useConfigStore / actual config files via
 *        parseKeybindingsFromFiles, persists via addEntry/updateEntry/
 *        removeEntry, undo/redo via zundo temporal store.
 * UI:    inline KeyRecorder for quick combo edits, BindingRow with
 *        ComboDisplay badges, category tabs (derived from dispatcher
 *        categories), search, per-binding reset, modified badges,
 *        conflict detection, full CRUD via BindingFormDialog.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useConfigStore } from "@/lib/config-store";
import {
  parseKeybindingsFromFiles,
  getActiveModeAtEnd,
  serializeBindingEntry,
  serializeModifiers,
  parseModifiers,
} from "@/lib/keybind-parse";
import type { PanelProps } from "@/lib/section-types";
import type { KeybindEntry } from "@/lib/keybind-types";
import { useFocusField } from "@/lib/use-focus-field";
import { DISPATCHER_MAP } from "@/lib/dispatchers";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Settings2, Search } from "lucide-react";
import { BindingFormDialog } from "./BindingFormDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KeyCombo {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  super?: boolean;
}

// ─── JS → XKB key name mapping ──────────────────────────────────────────────

function normalizeKeyName(jsKey: string): string {
  const map: Record<string, string> = {
    "Enter": "Return",
    " ": "space",
    "ArrowLeft": "Left",
    "ArrowRight": "Right",
    "ArrowUp": "Up",
    "ArrowDown": "Down",
    "Escape": "Escape",
    "Backspace": "BackSpace",
    "Delete": "Delete",
    "Insert": "Insert",
    "Home": "Home",
    "End": "End",
    "PageUp": "Page_Up",
    "PageDown": "Page_Down",
    "Tab": "Tab",
    "CapsLock": "Caps_Lock",
    "NumLock": "Num_Lock",
    "ScrollLock": "Scroll_Lock",
    "PrintScreen": "Print",
    "Pause": "Pause",
    "Menu": "Menu",
    "Super_L": "Super_L",
    "Super_R": "Super_R",
  };
  return map[jsKey] ?? jsKey;
}

// ─── Category mapping ───────────────────────────────────────────────────────
// Categories are derived solely from the dispatcher definitions in
// lib/dispatchers.ts — no special-casing or ad-hoc overrides.

function getEntryCategory(entry: KeybindEntry): string {
  const info = DISPATCHER_MAP.get(entry.func);
  return info?.category ?? "other";
}

function allCategories(entries: KeybindEntry[]): string[] {
  const cats = new Set(entries.map(getEntryCategory));
  return ["All", ...Array.from(cats).sort()];
}

// ─── Entry ↔ KeyCombo converters ────────────────────────────────────────────

function entryToCombo(entry: KeybindEntry): KeyCombo {
  const mods = parseModifiers(entry.mods);
  return {
    key: entry.key,
    ctrl: mods.includes("ctrl"),
    alt: mods.includes("alt"),
    shift: mods.includes("shift"),
    super: mods.includes("super"),
  };
}

function comboToMods(combo: KeyCombo): string {
  const parts: string[] = [];
  if (combo.super) parts.push("super");
  if (combo.ctrl) parts.push("ctrl");
  if (combo.alt) parts.push("alt");
  if (combo.shift) parts.push("shift");
  return serializeModifiers(parts);
}

// ─── Display helpers (from working tree) ────────────────────────────────────



function friendlyKey(key: string): string {
  const map: Record<string, string> = {
    " ": "Space", "ArrowLeft": "←", "ArrowRight": "→",
    "ArrowUp": "↑", "ArrowDown": "↓", "Return": "Enter",
    "Escape": "Esc", "minus": "−", "equal": "=",
    "bracketleft": "[", "bracketright": "]",
    "semicolon": ";", "apostrophe": "'",
    "comma": ",", "period": ".", "slash": "/",
    "backslash": "\\", "grave": "`",
    "Delete": "Del", "BackSpace": "Bcksp",
    "Print": "PrtSc", "Left": "←", "Right": "→",
    "Up": "↑", "Down": "↓", "space": "Space",
  };
  return map[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}

function combosMatch(a: KeyCombo | null, b: KeyCombo | null): boolean {
  if (a === null && b === null) return true;
  if (!a || !b) return false;
  return a.key === b.key && !!a.ctrl === !!b.ctrl && !!a.alt === !!b.alt
    && !!a.shift === !!b.shift && !!a.super === !!b.super;
}

function comboFromEvent(e: KeyboardEvent): KeyCombo | null {
  const ignored = new Set([
    "Control", "Alt", "Shift", "Meta", "Super_L", "Super_R",
    "Hyper_L", "Hyper_R", "CapsLock", "NumLock", "ScrollLock",
  ]);
  if (ignored.has(e.key)) return null;
  return {
    key: normalizeKeyName(e.key),
    ctrl:  e.ctrlKey  || undefined,
    alt:   e.altKey   || undefined,
    shift: e.shiftKey || undefined,
    super: e.metaKey  || undefined,
  };
}

// ─── Conflict helper ────────────────────────────────────────────────────────

function findEntryConflicts(
  allEntries: KeybindEntry[],
  entry: KeybindEntry,
  mods: string,
  key: string,
): KeybindEntry[] {
  return allEntries.filter((e) => {
    if (
      e.configKey === entry.configKey &&
      e.configIndex === entry.configIndex &&
      e.mode === entry.mode
    ) {
      return false; // skip self
    }
    return e.configKey === entry.configKey && e.mode === entry.mode && e.mods === mods && e.key === key;
  });
}

// ─── KeyBadge ─────────────────────────────────────────────────────────────────

function KeyBadge({ label }: { label: string }) {
  return (
    <kbd className={cn(
      "inline-flex items-center justify-center",
      "h-[22px] min-w-[22px] px-1.5",
      "rounded-[5px] font-mono text-[11px] font-medium leading-none",
      "border border-border bg-muted text-muted-foreground",
      "select-none shadow-[0_1px_0_0_hsl(var(--border))]",
    )}>
      {label}
    </kbd>
  );
}

// ─── ComboDisplay ─────────────────────────────────────────────────────────────

function ComboDisplay({ combo }: { combo: KeyCombo | null }) {
  if (!combo) {
    return <span className="text-xs text-muted-foreground/50 italic">Unbound</span>;
  }
  const parts: string[] = [];
  if (combo.ctrl)  parts.push("Ctrl");
  if (combo.alt)   parts.push("Alt");
  if (combo.shift) parts.push("Shift");
  if (combo.super) parts.push("Super");
  parts.push(friendlyKey(combo.key));

  return (
    <span className="inline-flex items-center gap-1">
      {parts.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          <KeyBadge label={p} />
          {i < parts.length - 1 && (
            <span className="text-[10px] text-muted-foreground/40 font-mono">+</span>
          )}
        </span>
      ))}
    </span>
  );
}

// ─── KeyRecorder ──────────────────────────────────────────────────────────────

interface KeyRecorderProps {
  value: KeyCombo | null;
  onRecorded: (combo: KeyCombo | null) => void;
  onCancel: () => void;
  conflict?: string;
}

function KeyRecorder({ value, onRecorded, onCancel, conflict }: KeyRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState<KeyCombo | null>(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const startRecording = useCallback(() => {
    setRecording(true);
    setPending(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === "Escape") {
      setRecording(false);
      setPending(value);
      onCancel();
      return;
    }

    const combo = comboFromEvent(e.nativeEvent);
    if (combo) {
      setPending(combo);
      setRecording(false);
    }
  }, [value, onCancel]);

  return (
    <div className="flex flex-col gap-2">
      <div className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
        "min-w-[220px]",
        recording
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border bg-background",
      )}>
        {recording ? (
          <>
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="text-xs text-muted-foreground flex-1">Press keys…</span>
            <kbd className="text-[10px] text-muted-foreground/50 border border-border rounded px-1">Esc to cancel</kbd>
          </>
        ) : pending ? (
          <>
            <ComboDisplay combo={pending} />
            <div className="flex-1" />
          </>
        ) : (
          <span className="text-xs text-muted-foreground/50 italic flex-1">Unbound</span>
        )}

        {/* Hidden input that captures key events during recording */}
        <input
          ref={inputRef}
          className="sr-only"
          aria-label="Key recorder input"
          onKeyDown={handleKeyDown}
          onBlur={() => { if (recording) { setRecording(false); setPending(value); }}}
          readOnly
        />
      </div>

      {conflict && !recording && (
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Conflicts with <span className="font-medium">{conflict}</span>
        </p>
      )}

      <div className="flex items-center gap-2">
        {!recording && (
          <button
            onClick={startRecording}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
              "border border-border bg-background hover:bg-muted transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
            </svg>
            {pending ? "Re-record" : "Record"}
          </button>
        )}
        {pending && !recording && (
          <button
            onClick={() => { setPending(null); }}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
              "border border-border text-muted-foreground hover:bg-muted transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
          >
            Unbind
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={() => onCancel()}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
            "border border-border text-muted-foreground hover:bg-muted transition-colors",
          )}
        >
          Cancel
        </button>
        <button
          onClick={() => onRecorded(pending)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
            "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ─── BindingRow ───────────────────────────────────────────────────────────────

interface BindingRowProps {
  entry: KeybindEntry;
  label: string;
  description: string;
  originalCombo: KeyCombo | null;
  isEditing: boolean;
  conflict?: string;
  onEdit: () => void;
  onSave: (combo: KeyCombo | null) => void;
  onCancelEdit: () => void;
  onReset: () => void;
  onDelete: () => void;
  onFullEdit: () => void;
}

function BindingRow({
  entry,
  label,
  description,
  originalCombo,
  isEditing,
  conflict,
  onEdit,
  onSave,
  onCancelEdit,
  onReset,
  onDelete,
  onFullEdit,
}: BindingRowProps) {
  const currentCombo = entryToCombo(entry);
  const isModified = !combosMatch(currentCombo, originalCombo);

  return (
    <div className={cn(
      "group grid gap-x-6 gap-y-1 px-4 py-3 transition-colors",
      "border-b border-border/50 last:border-0",
      isEditing
        ? "bg-muted/40"
        : "hover:bg-muted/30",
    )}
    style={{ gridTemplateColumns: "1fr auto" }}
    >
      {/* Label + description */}
      <div className="flex min-w-0 flex-col justify-center gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground leading-none">
            {label}
          </span>
          {isModified && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary leading-none">
              modified
            </span>
          )}
        </div>
        {description && (
          <span className="text-xs text-muted-foreground/70 leading-normal mt-0.5">
            {description}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1">
        {!isEditing ? (
          <>
            <button
              onClick={onEdit}
              aria-label={`Edit keybinding for ${label}`}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1 transition-colors",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            >
              <ComboDisplay combo={currentCombo} />
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" aria-hidden="true"
                className="text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              >
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
              </svg>
            </button>

            {/* Full edit (settings) */}
            <button
              onClick={onFullEdit}
              title="Edit action and flags"
              aria-label={`Edit action for ${label}`}
              className={cn(
                "flex-shrink-0 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity",
                "text-muted-foreground hover:text-foreground hover:bg-muted",
                "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            >
              <Settings2 className="size-3.5" />
            </button>

            {/* Reset */}
            {isModified && (
              <button
                onClick={onReset}
                title="Reset to original"
                aria-label={`Reset ${label} to original`}
                className={cn(
                  "flex-shrink-0 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity",
                  "text-muted-foreground hover:text-foreground hover:bg-muted",
                  "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                )}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
              </button>
            )}

            {/* Delete */}
            <button
              onClick={onDelete}
              title="Remove binding"
              aria-label={`Remove ${label}`}
              className={cn(
                "flex-shrink-0 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity",
                "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            >
              <Trash2 className="size-3.5" />
            </button>
          </>
        ) : (
          <KeyRecorder
            value={currentCombo}
            onRecorded={onSave}
            onCancel={onCancelEdit}
            conflict={conflict}
          />
        )}
      </div>
    </div>
  );
}

// ─── Undo toast data ──────────────────────────────────────────────────────────

interface UndoData {
  key: string;
  value: string;
  mode: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function KeybindingsPanel({ focusKey }: PanelProps) {
  const fieldRef = useFocusField(focusKey);
  const files = useConfigStore((s) => s.files);
  const addEntry = useConfigStore((s) => s.addEntry);
  const updateEntry = useConfigStore((s) => s.updateEntry);
  const removeEntry = useConfigStore((s) => s.removeEntry);

  // ── Derived data ──────────────────────────────────────────────────────────

  const allEntries = useMemo(() => parseKeybindingsFromFiles(files), [files]);

  // Store original combos for per-binding reset
  const originalCombosRef = useRef<Map<string, KeyCombo>>(new Map());

  // Keep originals in sync — reset whenever entries change structurally
  useEffect(() => {
    const map = new Map<string, KeyCombo>();
    for (const e of allEntries) {
      map.set(`${e.configKey}[${e.configIndex}]`, entryToCombo(e));
    }
    originalCombosRef.current = map;
  }, [allEntries]);

  // ── UI state ──────────────────────────────────────────────────────────────

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KeybindEntry | null>(null);
  const [undoData, setUndoData] = useState<UndoData | null>(null);

  const cats = useMemo(() => allCategories(allEntries), [allEntries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allEntries.filter((e) => {
      const cat = getEntryCategory(e);
      if (activeCategory !== "All" && cat !== activeCategory) return false;
      if (!q) return true;
      const desc = DISPATCHER_MAP.get(e.func)?.description ?? "";
      return (
        e.func.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q) ||
        e.key.toLowerCase().includes(q) ||
        e.mods.toLowerCase().includes(q) ||
        e.mode.toLowerCase().includes(q) ||
        e.args.toLowerCase().includes(q)
      );
    });
  }, [allEntries, search, activeCategory]);

  const grouped = useMemo(() => {
    const g = new Map<string, KeybindEntry[]>();
    for (const e of filtered) {
      const cat = getEntryCategory(e);
      const arr = g.get(cat) ?? [];
      arr.push(e);
      g.set(cat, arr);
    }
    return g;
  }, [filtered]);

  const modifiedCount = useMemo(
    () => allEntries.filter((e) => {
      const orig = originalCombosRef.current.get(`${e.configKey}[${e.configIndex}]`);
      return orig ? !combosMatch(entryToCombo(e), orig) : false;
    }).length,
    [allEntries],
  );

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // ── Conflict detection ────────────────────────────────────────────────────

  const getConflict = useCallback((entry: KeybindEntry): string | undefined => {
    const combo = entryToCombo(entry);
    if (!combo) return undefined;
    const mods = comboToMods(combo);
    const conflicts = findEntryConflicts(allEntries, entry, mods, combo.key);
    if (conflicts.length > 0) {
      const c = conflicts[0];
      return `${c.func} (${c.mods || "none"} + ${c.key})`;
    }
    return undefined;
  }, [allEntries]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const entryKey = (e: KeybindEntry) => `${e.configKey}[${e.configIndex}]`;

  const handleEdit = useCallback((entry: KeybindEntry) => {
    setEditingKey(entryKey(entry));
  }, []);

  const handleInlineSave = useCallback((entry: KeybindEntry, combo: KeyCombo | null) => {
    const newMods = combo ? comboToMods(combo) : "none";
    const newKey = combo ? combo.key : "";
    const newValue = [newMods, newKey, entry.func, entry.args].filter(Boolean).join(",");
    updateEntry(entry.configKey, entry.configIndex, newValue);
    setEditingKey(null);
  }, [updateEntry]);

  const handleCancelEdit = useCallback(() => {
    setEditingKey(null);
  }, []);

  const handleReset = useCallback((entry: KeybindEntry) => {
    const orig = originalCombosRef.current.get(entryKey(entry));
    if (orig) {
      const newMods = comboToMods(orig);
      const newValue = [newMods, orig.key, entry.func, entry.args].filter(Boolean).join(",");
      updateEntry(entry.configKey, entry.configIndex, newValue);
    }
  }, [updateEntry]);

  const handleResetAll = useCallback(() => {
    for (const e of allEntries) {
      const orig = originalCombosRef.current.get(entryKey(e));
      if (orig) {
        const newMods = comboToMods(orig);
        const newValue = [newMods, orig.key, e.func, e.args].filter(Boolean).join(",");
        updateEntry(e.configKey, e.configIndex, newValue);
      }
    }
    setShowResetConfirm(false);
  }, [allEntries, updateEntry]);

  const handleDelete = useCallback((entry: KeybindEntry) => {
    removeEntry(entry.configKey, entry.configIndex);
    setUndoData({
      key: entry.configKey,
      value: serializeBindingEntry(entry),
      mode: entry.mode,
    });
  }, [removeEntry]);

  const handleUndoDelete = useCallback(() => {
    if (!undoData) return;
    const { key, value, mode } = undoData;
    if (mode !== getActiveModeAtEnd(files)) {
      addEntry("keymode", mode);
    }
    addEntry(key, value);
    setUndoData(null);
  }, [undoData, files, addEntry]);

  // Auto-dismiss undo toast
  useEffect(() => {
    if (!undoData) return;
    const timer = setTimeout(() => setUndoData(null), 5000);
    return () => clearTimeout(timer);
  }, [undoData]);

  const handleOpenDialog = useCallback((entry?: KeybindEntry) => {
    setEditingEntry(entry ?? null);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingEntry(null);
  }, []);

  const existingModes = useMemo(
    () => Array.from(new Set(allEntries.map((e) => e.mode))),
    [allEntries],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div ref={fieldRef("keybindings")} className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">Keybindings</h2>
          <p className="text-sm text-muted-foreground">
            Manage system shortcuts, window rules, and custom shell scripts.
            Use the inline recorder to quickly change a key combination, or
            click the settings icon for the full editor.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          {/* Reset all */}
          {modifiedCount > 0 && !showResetConfirm && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
                "border border-border text-muted-foreground hover:bg-muted transition-colors",
              )}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
              </svg>
              Reset ({modifiedCount})
            </button>
          )}

          {showResetConfirm && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Reset all {modifiedCount} changes?</span>
              <button
                onClick={handleResetAll}
                className={cn(
                  "inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium",
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors",
                )}
              >
                Reset all
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className={cn(
                  "inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium",
                  "border border-border hover:bg-muted transition-colors",
                )}
              >
                Keep
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search + Category tabs */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 size-3.5" />
          <input
            type="search"
            placeholder="Search bindings by key, action, mode…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={cn(
              "h-9 w-full rounded-lg border border-border bg-background pl-9 pr-20 text-sm",
              "placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring",
              "transition-colors",
            )}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            <button
              onClick={() => handleOpenDialog()}
              aria-label="Add keybinding"
              title="Add keybinding"
              className={cn(
                "flex items-center justify-center size-5 rounded text-muted-foreground/50",
                "hover:text-foreground hover:bg-muted transition-colors",
              )}
            >
              <Plus className="size-3.5" />
            </button>
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="flex items-center justify-center size-5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Filter by category"
          className="flex gap-1 flex-wrap"
        >
          {cats.map(cat => (
            <button
              key={cat}
              role="tab"
              aria-selected={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "inline-flex h-7 items-center rounded-md px-3 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {cat}
              {cat === "All" && modifiedCount > 0 && (
                <span className={cn(
                  "ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1",
                  "text-[10px] font-medium leading-none",
                  activeCategory === cat
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-primary/10 text-primary",
                )}>
                  {modifiedCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Binding list */}
      {allEntries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/30" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <p className="text-sm text-muted-foreground">No bindings configured.</p>
          <button
            onClick={() => handleOpenDialog()}
            className="text-xs text-primary hover:underline"
          >
            Add your first keybinding
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
          <Search className="size-6 text-muted-foreground/30" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No bindings match <span className="font-medium text-foreground">"{search}"</span></p>
          <button onClick={() => setSearch("")} className="text-xs text-primary hover:underline">Clear search</button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {[...grouped.entries()].map(([category, items]) => (
            <section key={category} aria-label={category}>
              {(activeCategory === "All" || grouped.size > 1) && (
                <div className="mb-1 flex items-center gap-3 px-1">
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    {category}
                  </h3>
                  <div className="h-px flex-1 bg-border/50" />
                  <span className="text-[11px] text-muted-foreground/40">
                    {items.length}
                  </span>
                </div>
              )}
              <div className="rounded-xl border border-border overflow-hidden">
                {items.map(e => {
                  const desc = DISPATCHER_MAP.get(e.func)?.description ?? (e.args || e.func);
                  const ek = entryKey(e);
                  return (
                    <BindingRow
                      key={ek}
                      entry={e}
                      label={e.func}
                      description={desc}
                      originalCombo={originalCombosRef.current.get(ek) ?? null}
                      isEditing={editingKey === ek}
                      conflict={
                        editingKey === ek
                          ? getConflict(e)
                          : undefined
                      }
                      onEdit={() => handleEdit(e)}
                      onSave={combo => handleInlineSave(e, combo)}
                      onCancelEdit={handleCancelEdit}
                      onReset={() => handleReset(e)}
                      onDelete={() => handleDelete(e)}
                      onFullEdit={() => handleOpenDialog(e)}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Undo delete toast */}
      {undoData && (
        <div className="fixed bottom-6 right-6 flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3 shadow-lg z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
          <span className="text-sm text-muted-foreground">Binding removed</span>
          <Button size="sm" variant="outline" onClick={handleUndoDelete}>
            Undo
          </Button>
        </div>
      )}

      {/* Add / Full-edit dialog */}
      <BindingFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        addEntry={addEntry}
        updateEntry={updateEntry}
        removeEntry={removeEntry}
        files={files}
        existingModes={existingModes}
        allEntries={allEntries}
        editingEntry={editingEntry}
      />
    </div>
  );
}
