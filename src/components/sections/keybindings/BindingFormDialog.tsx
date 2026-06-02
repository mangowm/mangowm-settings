import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Terminal, Settings2, Command } from "lucide-react";
import type { SourceFile } from "@/lib/config-types";
import type { KeybindEntry, KeybindFlags } from "@/lib/keybind-types";
import { bindKeyFromFlags, serializeModifiers, parseModifiers, getActiveModeAtEnd } from "@/lib/keybind-parse";
import { DispatcherCombobox } from "./DispatcherCombobox";
import { KeyCombobox } from "./KeyCombobox";

const MODIFIERS = ["super", "ctrl", "alt", "shift"];
const MODIFIER_ORDER = ["super", "ctrl", "alt", "shift"];

function findConflicts(
  allEntries: KeybindEntry[],
  configKey: string,
  mode: string,
  mods: string,
  key: string,
  editingEntry?: KeybindEntry | null,
): KeybindEntry[] {
  return allEntries.filter((e) => {
    if (
      editingEntry &&
      e.configKey === editingEntry.configKey &&
      e.configIndex === editingEntry.configIndex
    ) {
      return false;
    }
    return e.configKey === configKey && e.mode === mode && e.mods === mods && e.key === key;
  });
}

interface BindingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addEntry: (key: string, value: string) => void;
  updateEntry: (key: string, index: number, value: string) => void;
  removeEntry: (key: string, index: number) => void;
  files: SourceFile[];
  existingModes: string[];
  allEntries: KeybindEntry[];
  editingEntry?: KeybindEntry | null;
}

export function BindingFormDialog({
  open,
  onOpenChange,
  addEntry,
  updateEntry,
  removeEntry,
  files,
  existingModes,
  allEntries,
  editingEntry,
}: BindingFormDialogProps) {
  const [mode, setMode] = useState("default");
  const [flags, setFlags] = useState<KeybindFlags>({
    keysym: true,
    lock: false,
    release: false,
    pass: false,
  });
  const [selectedMods, setSelectedMods] = useState<string[]>([]);
  const [key, setKey] = useState("");
  const [func, setFunc] = useState("");
  const [args, setArgs] = useState("");

  const isEditing = !!editingEntry;

  useEffect(() => {
    if (!open) return;
    if (editingEntry) {
      setMode(editingEntry.mode);
      setSelectedMods(parseModifiers(editingEntry.mods));
      setKey(editingEntry.key);
      setFunc(editingEntry.func);
      setArgs(editingEntry.args ?? "");
      setFlags({ ...editingEntry.flags });
    } else {
      setMode("default");
      setSelectedMods([]);
      setKey("");
      setFunc("");
      setArgs("");
      setFlags({ keysym: true, lock: false, release: false, pass: false });
    }
  }, [open, editingEntry]);

  const configKey = useMemo(() => bindKeyFromFlags(flags), [flags]);

  const modString = useMemo(() => {
    const sorted = [...selectedMods].sort(
      (a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b),
    );
    return serializeModifiers(sorted);
  }, [selectedMods]);

  const conflicts = useMemo(() => {
    if (!key.trim()) return [];
    return findConflicts(allEntries, configKey, mode, modString, key.trim(), editingEntry);
  }, [allEntries, configKey, mode, modString, key, editingEntry]);

  const addModeAwareEntry = useCallback(
    (configKey: string, value: string) => {
      if (mode !== getActiveModeAtEnd(files)) {
        addEntry("keymode", mode);
      }
      addEntry(configKey, value);
    },
    [mode, files, addEntry],
  );

  const handleSubmit = () => {
    if (!key.trim() || !func.trim()) return;

    const value = [modString, key.trim(), func.trim(), args.trim()].filter(Boolean).join(",");

    if (editingEntry) {
      const keyChanged = configKey !== editingEntry.configKey;
      const modeChanged = mode !== editingEntry.mode;
      if (keyChanged || modeChanged) {
        removeEntry(editingEntry.configKey, editingEntry.configIndex);
        addModeAwareEntry(configKey, value);
      } else {
        updateEntry(editingEntry.configKey, editingEntry.configIndex, value);
      }
    } else {
      addModeAwareEntry(configKey, value);
    }

    onOpenChange(false);
  };

  const toggleMod = (m: string) => {
    setSelectedMods((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]));
  };

  const hasConflict = conflicts.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-8 p-8">
        <DialogHeader className="gap-2">
          <DialogTitle className="text-2xl">
            {isEditing ? "Edit Shortcut" : "Create Shortcut"}
          </DialogTitle>
          <DialogDescription className="text-base">
            {isEditing
              ? "Modify the key combination, action, or context flags."
              : "Bind a key combination to a system action or a custom shell script."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-7 flex flex-col gap-6">
            <div className="space-y-3">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Command className="size-4 text-muted-foreground" /> Key Combination
              </label>
              <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-4">
                <div className="flex flex-wrap gap-2">
                  {MODIFIERS.map((m) => (
                    <button
                      key={m}
                      onClick={() => toggleMod(m)}
                      aria-pressed={selectedMods.includes(m)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border-b-4 active:border-b-0 active:translate-y-[4px] ${
                        selectedMods.includes(m)
                          ? "bg-primary text-primary-foreground border-primary/60"
                          : "bg-background border-border hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xl font-mono text-muted-foreground/50 shrink-0">+</span>
                  <div className="flex-1">
                    <KeyCombobox value={key} onChange={setKey} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Terminal className="size-4 text-muted-foreground" /> Dispatcher &amp; Script
              </label>
              <div className="flex flex-col gap-4">
                <DispatcherCombobox value={func} onChange={setFunc} />
                <textarea
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  placeholder="Arguments or full shell script (e.g. sh -c 'notify-send Hello')"
                  className="w-full min-h-[120px] resize-y bg-background border border-border/50 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/40"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-5 flex flex-col gap-6 p-6 rounded-xl bg-muted/20 border border-border/40">
            <h4 className="text-sm font-semibold flex items-center gap-2 pb-2 border-b border-border/50">
              <Settings2 className="size-4 text-muted-foreground" /> Context &amp; Flags
            </h4>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Submap / Mode</label>
                <input
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  list="modes-list"
                  placeholder="default"
                  className="w-full bg-background border border-border/50 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <datalist id="modes-list">
                  {existingModes.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Isolate this binding to a specific context (e.g., &apos;resize&apos; mode).
                </p>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Lockscreen Passthrough</label>
                  <p className="text-[11px] text-muted-foreground max-w-[160px]">
                    Execute action even while compositor is locked.
                  </p>
                </div>
                <Switch
                  checked={flags.lock}
                  onCheckedChange={(c) => setFlags((p) => ({ ...p, lock: c }))}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Trigger on Release</label>
                  <p className="text-[11px] text-muted-foreground max-w-[160px]">
                    Wait until key is let go before executing.
                  </p>
                </div>
                <Switch
                  checked={flags.release}
                  onCheckedChange={(c) => setFlags((p) => ({ ...p, release: c }))}
                />
              </div>
            </div>
          </div>
        </div>

        {hasConflict && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            <span className="font-medium">&#9888; Conflict: </span>
            {conflicts[0].mods}+{conflicts[0].key} already runs{" "}
            <code className="font-mono text-xs font-semibold">{conflicts[0].func}</code> in
            &quot;{conflicts[0].mode}&quot; mode
          </div>
        )}

        <DialogFooter className="border-t border-border/40 pt-6 mt-2">
          <Button variant="ghost" size="lg" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={!key || !func}
            className="px-8 shadow-md"
          >
            {isEditing ? "Update Binding" : "Save Binding"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
