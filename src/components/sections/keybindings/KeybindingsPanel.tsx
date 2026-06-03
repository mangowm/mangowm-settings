/**
 * KeybindingsPanel
 *
 * Lists all keyboard bindings with category filtering, search, conflict
 * detection, per-binding reset, and a full CRUD dialog for editing.
 * Combo editing uses the dialog's modifier buttons (interception-safe)
 * + useKeyRecorder for key-only capture — no inline recorder.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useConfigStore } from "@/lib/config-store";
import {
  parseKeybindingsFromFiles,
  serializeBindingEntry,
  parseModifiers,
} from "@/lib/keybind-parse";
import { xkbToDisplay } from "@/lib/key-name-map";
import type { PanelProps } from "@/lib/section-types";
import type { KeybindEntry } from "@/lib/keybind-types";
import { useFocusField } from "@/lib/use-focus-field";
import { DISPATCHER_MAP } from "@/lib/dispatchers";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Search } from "lucide-react";
import { BindingFormDialog } from "./BindingFormDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

// KeyCombo mirrors the combo shape used throughout the panel for
// entry↔combo conversions.
interface KeyCombo {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  super: boolean;
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
  if (!combo || !combo.key) {
    return <span className="text-xs text-muted-foreground/50 italic">Unbound</span>;
  }
  const parts: string[] = [];
  if (combo.ctrl)  parts.push("Ctrl");
  if (combo.alt)   parts.push("Alt");
  if (combo.shift) parts.push("Shift");
  if (combo.super) parts.push("Super");
  parts.push(xkbToDisplay(combo.key));

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

// ─── BindingRow ───────────────────────────────────────────────────────────────

interface BindingRowProps {
  entry: KeybindEntry;
  label: string;
  description: string;
  onEdit: () => void;
  onDelete: () => void;
}

function BindingRow({
  entry,
  label,
  description,
  onEdit,
  onDelete,
}: BindingRowProps) {
  const currentCombo = useMemo(() => entryToCombo(entry), [entry]);

  return (
    <div className={cn(
      "group grid gap-x-6 gap-y-1 px-4 py-3 transition-colors",
      "border-b border-border/50 last:border-0",
      "hover:bg-muted/30",
    )}
    style={{ gridTemplateColumns: "1fr auto" }}
    >
      {/* Label + description */}
      <div className="flex min-w-0 flex-col justify-center gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground leading-none">
            {label}
          </span>
        </div>
        {description && (
          <span className="text-xs text-muted-foreground/70 leading-normal mt-0.5">
            {description}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1">
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
      </div>
    </div>
  );
}

// ─── Undo toast data ──────────────────────────────────────────────────────────

interface UndoData {
  key: string;
  value: string;
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

  // ── UI state ──────────────────────────────────────────────────────────────

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
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

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDelete = useCallback((entry: KeybindEntry) => {
    removeEntry(entry.configKey, entry.configIndex);
    setUndoData({
      key: entry.configKey,
      value: serializeBindingEntry(entry),
    });
  }, [removeEntry]);

  const handleUndoDelete = useCallback(() => {
    if (!undoData) return;
    const { key, value } = undoData;
    addEntry(key, value);
    setUndoData(null);
  }, [undoData, addEntry]);

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
            Click a keybinding to open the full editor.
          </p>
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
                  return (
                    <BindingRow
                      key={e.id}
                      entry={e}
                      label={e.func}
                      description={desc}
                      onEdit={() => handleOpenDialog(e)}
                      onDelete={() => handleDelete(e)}
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
