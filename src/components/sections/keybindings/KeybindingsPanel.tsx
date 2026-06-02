import { useMemo, useState, useEffect, useCallback } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useConfigStore, undo, redo } from "@/lib/config-store";
import { parseKeybindingsFromFiles, getActiveModeAtEnd, serializeBindingEntry } from "@/lib/keybind-parse";
import type { PanelProps } from "@/lib/section-types";
import type { KeybindEntry } from "@/lib/keybind-types";
import { useFocusField } from "@/lib/use-focus-field";
import { PanelShell } from "@/components/sections/section-ui";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layers, KeyboardIcon, Search, Undo, Redo, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MANGO_DISPATCHERS } from "@/lib/dispatchers";
import { BindingFormDialog } from "./BindingFormDialog";
import { KeybindItem } from "./KeybindItem";

function groupByMode(entries: KeybindEntry[]) {
  const groups = new Map<string, KeybindEntry[]>();
  for (const entry of entries) {
    const list = groups.get(entry.mode) ?? [];
    list.push(entry);
    groups.set(entry.mode, list);
  }
  return groups;
}

function sortModes(grouped: Map<string, KeybindEntry[]>): string[] {
  return Array.from(grouped.keys()).sort((a, b) => {
    if (a === "default") return -1;
    if (b === "default") return 1;
    if (a === "common") return -1;
    if (b === "common") return 1;
    return a.localeCompare(b);
  });
}

function filterEntries(entries: KeybindEntry[], query: string): KeybindEntry[] {
  if (!query.trim()) return entries;
  const lower = query.toLowerCase();
  return entries.filter((e) => {
    const desc = MANGO_DISPATCHERS.find((d) => d.name === e.func)?.description ?? "";
    return (
      e.key.toLowerCase().includes(lower) ||
      e.mods.toLowerCase().includes(lower) ||
      e.func.toLowerCase().includes(lower) ||
      desc.toLowerCase().includes(lower) ||
      e.mode.toLowerCase().includes(lower) ||
      e.args.toLowerCase().includes(lower)
    );
  });
}

interface UndoData {
  key: string;
  value: string;
  mode: string;
}

export function KeybindingsPanel({ focusKey }: PanelProps) {
  const fieldRef = useFocusField(focusKey);
  const files = useConfigStore((s) => s.files);
  const addEntry = useConfigStore((s) => s.addEntry);
  const updateEntry = useConfigStore((s) => s.updateEntry);
  const removeEntry = useConfigStore((s) => s.removeEntry);

  const { canUndo, canRedo } = useStore(
    useConfigStore.temporal,
    useShallow((s) => ({
      canUndo: s.pastStates.length > 0,
      canRedo: s.futureStates.length > 0,
    })),
  );

  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KeybindEntry | null>(null);
  const [undoData, setUndoData] = useState<UndoData | null>(null);

  const allEntries = useMemo(() => parseKeybindingsFromFiles(files), [files]);
  const allGrouped = useMemo(() => groupByMode(allEntries), [allEntries]);
  const allModes = useMemo(() => sortModes(allGrouped), [allGrouped]);

  const filteredEntries = useMemo(
    () => filterEntries(allEntries, query),
    [allEntries, query],
  );
  const filteredGrouped = useMemo(() => groupByMode(filteredEntries), [filteredEntries]);
  const filteredModes = useMemo(() => sortModes(filteredGrouped), [filteredGrouped]);

  useEffect(() => {
    if (undoData) {
      const timer = setTimeout(() => setUndoData(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [undoData]);

  const handleDelete = useCallback(
    (entry: KeybindEntry) => {
      removeEntry(entry.configKey, entry.configIndex);
      setUndoData({
        key: entry.configKey,
        value: serializeBindingEntry(entry),
        mode: entry.mode,
      });
    },
    [removeEntry],
  );

  const handleUndo = useCallback(() => {
    if (!undoData) return;
    if (undoData.mode !== getActiveModeAtEnd(files)) {
      addEntry("keymode", undoData.mode);
    }
    addEntry(undoData.key, undoData.value);
    setUndoData(null);
  }, [undoData, files, addEntry]);

  const handleEdit = useCallback((entry: KeybindEntry) => {
    setEditingEntry(entry);
    setDialogOpen(true);
  }, []);

  const handleAdd = useCallback(() => {
    setEditingEntry(null);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingEntry(null);
    }
  }, []);

  return (
    <TooltipProvider delay={200}>
      <PanelShell>
        <div ref={fieldRef("keybindings")} className="flex flex-col gap-10">
          <div className="flex flex-col gap-6 bg-card/30 p-6 rounded-2xl border border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  Keybindings &amp; Submaps
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manage system shortcuts, window rules, and custom shell scripts.
                </p>
              </div>
              <Button size="lg" className="gap-2 shadow-md shrink-0" onClick={handleAdd}>
                <Plus className="size-5" /> New Keybinding
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/40 pointer-events-none" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search bindings by key, action, mode…"
                  className="w-full bg-background border border-border/50 rounded-lg pl-9 pr-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/40 transition-colors"
                  spellCheck={false}
                  aria-label="Search keybindings"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={undo}
                disabled={!canUndo}
                title="Undo"
                className="size-9 text-muted-foreground/50 hover:text-foreground disabled:opacity-20"
              >
                <Undo className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={redo}
                disabled={!canRedo}
                title="Redo"
                className="size-9 text-muted-foreground/50 hover:text-foreground disabled:opacity-20"
              >
                <Redo className="size-4" />
              </Button>
            </div>
          </div>

          {allEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/5 py-16 text-center">
              <KeyboardIcon className="mb-3 size-8 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No bindings configured.</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/5 py-16 text-center">
              <Search className="mb-3 size-8 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">
                No bindings match &quot;{query}&quot;
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-12">
              {filteredModes.map((mode) => {
                const modeEntries = filteredGrouped.get(mode);
                if (!modeEntries || modeEntries.length === 0) return null;

                return (
                  <section key={mode} className="flex flex-col gap-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Layers className="size-5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold tracking-tight text-foreground capitalize">
                          {mode === "common" ? "Global (Common)" : `${mode} Mode`}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {modeEntries.length} shortcut{modeEntries.length === 1 ? "" : "s"}{" "}
                          defined
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 pl-0 sm:pl-14">
                      {modeEntries.map((entry) => (
                        <KeybindItem
                          key={`${entry.configKey}[${entry.configIndex}]`}
                          entry={entry}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {undoData && (
          <div className="fixed bottom-6 right-6 flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3 shadow-lg z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
            <span className="text-sm text-muted-foreground">Binding removed</span>
            <Button size="sm" variant="outline" onClick={handleUndo}>
              Undo
            </Button>
          </div>
        )}

        <BindingFormDialog
          open={dialogOpen}
          onOpenChange={handleDialogClose}
          addEntry={addEntry}
          updateEntry={updateEntry}
          removeEntry={removeEntry}
          files={files}
          existingModes={allModes}
          allEntries={allEntries}
          editingEntry={editingEntry}
        />
      </PanelShell>
    </TooltipProvider>
  );
}
