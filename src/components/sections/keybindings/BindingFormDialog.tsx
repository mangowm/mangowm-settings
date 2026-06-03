import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Keyboard,
  AlertCircle,
  ChevronsUpDown,
  Command as CmdIcon,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Domain Imports
import { useKeyRecorder } from "@/lib/key-recorder";
import { KEY_GROUPS } from "./key-names";
import { xkbToDisplay } from "@/lib/key-name-map";
import { bindKeyFromFlags, serializeModifiers, parseModifiers, findInsertPosition } from "@/lib/keybind-parse";
import { DISPATCHER_MAP, getDispatchersByCategory, parseArgValues, serializeArgValues, validateAllArgs } from "@/lib/dispatchers";
import { ModeCombobox } from "./ModeCombobox";
import type { KeybindEntry, KeybindFlags } from "@/lib/keybind-types";
import type { SourceFile } from "@/lib/config-types";
import type { DispatcherArg } from "@/lib/dispatchers";

// ─── UTILITIES ───────────────────────────────────────────────────────────

const MODIFIER_ORDER = ["super", "ctrl", "alt", "shift"];

function findConflicts(allEntries: KeybindEntry[], configKey: string, mode: string, mods: string, key: string, editingEntry?: KeybindEntry | null) {
  return allEntries.filter((e) => {
    if (editingEntry && e.id === editingEntry.id) return false;
    return e.configKey === configKey && e.mode === mode && e.mods === mods && e.key === key;
  });
}

// ─── MAIN DIALOG ─────────────────────────────────────────────────────────

interface BindingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insertEntry: (key: string, value: string, options: { fileIdx: number; afterLineIdx: number }) => void;
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
  insertEntry,
  updateEntry,
  removeEntry,
  files,
  existingModes,
  allEntries,
  editingEntry,
}: BindingFormDialogProps) {
  
  // State
  const [selectedMods, setSelectedMods] = useState<string[]>([]);
  const [key, setKey] = useState("");
  const [func, setFunc] = useState("");
  const [args, setArgs] = useState("");
  const [argErrors, setArgErrors] = useState<Record<string, string | null>>({});
  const [mode, setMode] = useState("default");
  const [flags, setFlags] = useState<KeybindFlags>({ keysym: true, lock: false, release: false, pass: false });
  
  // UI States
  const [isRecording, setIsRecording] = useState(false);
  const [isKeySearchOpen, setIsKeySearchOpen] = useState(false);

  // Initialize
  useEffect(() => {
    if (!open) return;
    setIsKeySearchOpen(false);
    setIsRecording(!editingEntry); // Don't auto-record when editing
    
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
      setArgErrors({});
    }
  }, [open, editingEntry]);

  // Derived Schema & Arguments
  const currentSchema = useMemo(() => DISPATCHER_MAP.get(func)?.args ?? [], [func]);
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  
  useEffect(() => {
    setArgValues(parseArgValues(args, currentSchema));
  }, [args, currentSchema]);

  const handleArgChange = useCallback((argName: string, value: string) => {
    setArgValues((prev) => {
      const next = { ...prev, [argName]: value };
      setArgs(serializeArgValues(next, currentSchema));
      const err = validateAllArgs(next, currentSchema);
      setArgErrors((prevErr) => err[argName] !== prevErr[argName] ? { ...prevErr, [argName]: err[argName] ?? null } : prevErr);
      return next;
    });
  }, [currentSchema]);

  // Capture Integration
  const captureInputRef = useRef<HTMLInputElement>(null);
  const keyRecorder = useKeyRecorder(
    useCallback((combo) => { 
      setKey(combo.key); 
      setIsRecording(false); // Stop recording once a key is hit
    }, [])
  );

  useEffect(() => {
    if (isRecording && !isKeySearchOpen) {
      keyRecorder.start();
      captureInputRef.current?.focus();
    } else {
      keyRecorder.cancel();
    }
  }, [isRecording, isKeySearchOpen, keyRecorder]);

  const toggleMod = (m: string) => {
    setSelectedMods(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m]);
    if (!isRecording) setIsRecording(true);
  };

  // Conflicts
  const configKey = useMemo(() => bindKeyFromFlags(flags), [flags]);
  const modString = useMemo(() => [...selectedMods].sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b)).join("+") || "none", [selectedMods]);
  
  const conflicts = useMemo(() => {
    if (!key.trim()) return [];
    const resolvedEditing = editingEntry ? allEntries.find((e) => e.id === editingEntry.id) : null;
    return findConflicts(allEntries, configKey, mode, modString, key.trim(), resolvedEditing);
  }, [allEntries, configKey, mode, modString, key, editingEntry]);

  // Submissions
  const handleSubmit = () => {
    if (!key.trim() || !func.trim()) return;
    const errors = validateAllArgs(argValues, currentSchema);
    setArgErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    const value = [modString, key.trim(), func.trim(), args.trim()].filter(Boolean).join(",");
    const resolvedEditing = editingEntry ? allEntries.find((e) => e.id === editingEntry.id) : null;

    if (resolvedEditing) {
      if (configKey !== resolvedEditing.configKey || mode !== resolvedEditing.mode) {
        removeEntry(resolvedEditing.configKey, resolvedEditing.configIndex);
        addModeAwareEntry(configKey, value);
      } else {
        updateEntry(resolvedEditing.configKey, resolvedEditing.configIndex, value);
      }
    } else {
      addModeAwareEntry(configKey, value);
    }
    onOpenChange(false);
  };

  const addModeAwareEntry = (cfgKey: string, val: string) => {
    const fileIdx = files.findIndex((f) => cfgKey in f.data);
    const targetFileIdx = fileIdx === -1 ? 0 : fileIdx;
    const lines = files[targetFileIdx]?.lines ?? [];
    const pos = findInsertPosition(lines, targetFileIdx, mode);
    
    if (pos) {
      insertEntry(cfgKey, val, pos);
    } else {
      const targetFile = files[targetFileIdx];
      const lastLineIdx = targetFile ? targetFile.lines.length - 1 : 0;
      if (mode !== "default") {
        insertEntry("keymode", mode, { fileIdx: targetFileIdx, afterLineIdx: lastLineIdx });
        insertEntry(cfgKey, val, { fileIdx: targetFileIdx, afterLineIdx: lastLineIdx + 1 });
      } else {
        insertEntry(cfgKey, val, { fileIdx: targetFileIdx, afterLineIdx: lastLineIdx });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl overflow-hidden p-0 shadow-2xl sm:rounded-[1.5rem] border-border bg-background">
        
        {/* Hidden capture input - ONLY active when isRecording is true */}
        <input
          ref={captureInputRef}
          className="sr-only"
          aria-label="Key capture input"
          onKeyDown={(e) => { if (e.key !== "Escape") keyRecorder.handleKeyEvent(e.nativeEvent); }}
          onBlur={(e) => {
            // Only stop recording if focus truly left the dialog
            // relatedTarget can be null when clicking non-focusable elements,
            // so we check after a tick whether focus is still inside the dialog
            requestAnimationFrame(() => {
              const dialog = e.currentTarget.closest('[data-slot="dialog-content"]');
              if (dialog?.contains(document.activeElement)) return;
              setIsRecording(false);
            });
          }}
          readOnly
        />

        <DialogHeader className="px-8 pt-8 pb-5 border-b border-border/40 bg-muted/20">
          <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
            {editingEntry ? "Edit Shortcut" : "New Shortcut"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Define a keyboard combination and configure the action it triggers.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-8 px-8 py-8 overflow-y-auto max-h-[70vh]">
          
          {/* ─── KEY CAPTURE ──────────────────────────────────────────────── */}
          <section className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Combination
            </span>
            <div 
              className={cn(
                "relative flex flex-col items-center justify-center rounded-xl border py-8 transition-all cursor-pointer gap-5",
                isRecording 
                  ? "border-primary/50 bg-primary/5 ring-4 ring-primary/10 shadow-sm" 
                  : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40"
              )}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('[data-slot="popover-trigger"]')) return;
                setIsRecording(true);
              }}
            >
              {/* ── Modifiers section ── */}
              <div className="flex flex-col items-center gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                  Modifiers (click to toggle)
                </span>
                <div className="flex flex-wrap justify-center items-center gap-2.5">
                  {MODIFIER_ORDER.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleMod(m); }}
                      className={cn(
                        "relative flex items-center justify-center h-10 min-w-[3.75rem] rounded-lg border font-semibold tracking-widest select-none transition-all duration-100 text-[11px] uppercase px-3.5",
                        "before:absolute before:inset-0 before:rounded-lg before:bg-gradient-to-b before:from-white/[0.08] before:to-transparent",
                        selectedMods.includes(m)
                          ? "bg-primary text-primary-foreground border-primary/30 shadow-sm translate-y-px"
                          : "border-dashed border-muted-foreground/25 text-muted-foreground/45 bg-transparent hover:bg-muted/30 hover:border-muted-foreground/50 hover:text-muted-foreground/70"
                      )}
                    >
                      <span className="relative z-10">{m}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Visual divider */}
              <div className="flex items-center gap-3 w-full max-w-[280px]">
                <div className="flex-1 h-px bg-border/20" />
                <Keyboard className="size-3.5 text-muted-foreground/20 shrink-0" />
                <div className="flex-1 h-px bg-border/20" />
              </div>

              {/* ── Key section ── */}
              <div className="flex flex-col items-center gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                  Key (press a key or choose from menu)
                </span>
                <div className="flex items-center gap-0">
                  {/* Key display - click to record */}
                  {key ? (
                    <div
                      className={cn(
                        "relative flex h-12 items-center justify-center rounded-l-lg border border-r-0 px-4 transition-all cursor-pointer select-none font-sans font-bold tracking-widest text-sm group",
                        "border-border/60 bg-card border-b-[3px] border-b-border/80",
                        isRecording
                          ? "border-primary/40 bg-primary/5 shadow-sm"
                          : "hover:border-primary/30 hover:bg-primary/[0.03]"
                      )}
                      onClick={() => setIsRecording(true)}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="relative z-10">{xkbToDisplay(key)}</span>
                      {!isRecording && (
                        <span className="ml-2 text-[9px] font-normal uppercase tracking-wider text-muted-foreground/30 transition-all group-hover:text-primary/60 group-hover:ml-2.5">
                          change
                        </span>
                      )}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "flex h-12 min-w-[6rem] items-center justify-center rounded-l-lg border-2 border-r-0 px-4 transition-colors cursor-pointer select-none",
                        isRecording ? "border-primary/40 bg-background/50" : "border-border/60 bg-background/30 hover:bg-muted/30"
                      )}
                      onClick={() => setIsRecording(true)}
                      role="button"
                      tabIndex={0}
                    >
                      <span className={cn(
                        "text-xs font-semibold tracking-widest uppercase",
                        isRecording ? "animate-pulse text-primary/80" : "text-muted-foreground/50"
                      )}>
                        {isRecording ? "Listening" : "No Key"}
                      </span>
                    </div>
                  )}
                  
                  {/* Dropdown menu trigger */}
                  <Popover open={isKeySearchOpen} onOpenChange={(open) => { setIsKeySearchOpen(open); if (open) setIsRecording(false); }}>
                    <PopoverTrigger
                      render={
                        <button
                          className={cn(
                            "flex items-center justify-center h-12 w-7 rounded-r-lg border transition-colors shrink-0",
                            key
                              ? "border-l-0 border-border/60 bg-card hover:bg-muted shadow-sm"
                              : "border-l-0 border-2",
                            isRecording && (key
                              ? "border-primary/40 bg-primary/5"
                              : "border-primary/40 bg-background/50"
                            )
                          )}
                          onClick={(e) => e.stopPropagation()}
                          title="Choose from key list"
                        >
                          <ChevronsUpDown className="size-3.5 text-muted-foreground/40" />
                        </button>
                      }
                    />
                    <PopoverContent className="w-64 p-0 rounded-xl shadow-lg border-border/50" align="center" sideOffset={6}>
                      <Command className="border-0">
                        <CommandInput placeholder="Search keys..." className="h-10 text-sm border-none focus:ring-0" />
                        <CommandList className="max-h-[220px]">
                          <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No keys found.</CommandEmpty>
                          {KEY_GROUPS.map((group) => (
                            <CommandGroup key={group.label} heading={group.label}>
                              {group.keys.map((k) => (
                                <CommandItem
                                  key={k.name}
                                  value={`${k.name} ${k.aliases?.join(" ")}`}
                                  onSelect={() => {
                                    setKey(k.name);
                                    setIsKeySearchOpen(false);
                                  }}
                                >
                                  <span className="font-mono text-sm">{k.name}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {!isRecording && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                  <Keyboard className="size-3" /> Click to record or choose
                </div>
              )}
            </div>
          </section>

          {/* ─── ACTION TRIGGER ───────────────────────────────────────────── */}
          <section className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Trigger Action
            </span>
            <div className="flex flex-col rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
              <div className="p-1">
                <ActionSelectCombobox value={func} onChange={(v) => { setFunc(v); setIsRecording(false); }} />
              </div>
              
              {/* Arguments Group */}
              {func && currentSchema.length > 0 && (
                <div className="flex flex-col divide-y divide-border/30 border-t border-border/30 animate-in fade-in slide-in-from-top-1">
                  {currentSchema.map((arg) => (
                    <DynamicArgField
                      key={arg.name}
                      arg={arg}
                      value={argValues[arg.name] ?? ""}
                      error={argErrors[arg.name] ?? null}
                      onChange={(v) => handleArgChange(arg.name, v)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ─── CONTEXT & FLAGS ────────────────────────────────────────── */}
          <section className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Context & Flags
            </span>
            <div className="flex flex-col rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden divide-y divide-border/30">
              
              {/* Submap / Mode */}
              <div className="flex items-center justify-between p-4 bg-muted/5">
                <div className="flex flex-col gap-1 pr-4">
                  <Label className="text-sm font-medium leading-none text-foreground">Submap Context</Label>
                  <span className="text-xs text-muted-foreground">Restrict this binding to a specific mode.</span>
                </div>
                <ModeCombobox
                  value={mode}
                  existingModes={existingModes}
                  onChange={setMode}
                />
              </div>

              {/* Flags */}
              <div className="flex items-center justify-between p-4">
                <div className="flex flex-col gap-1 pr-4">
                  <Label className="text-sm font-medium leading-none text-foreground">Lockscreen Passthrough</Label>
                  <span className="text-xs text-muted-foreground">Execute while the system is locked.</span>
                </div>
                <Switch checked={flags.lock} onCheckedChange={(c) => setFlags({...flags, lock: c})} />
              </div>

              <div className="flex items-center justify-between p-4">
                <div className="flex flex-col gap-1 pr-4">
                  <Label className="text-sm font-medium leading-none text-foreground">Trigger on Release</Label>
                  <span className="text-xs text-muted-foreground">Wait until the key is lifted to execute.</span>
                </div>
                <Switch checked={flags.release} onCheckedChange={(c) => setFlags({...flags, release: c})} />
              </div>

            </div>
          </section>
        </div>

        {/* ─── FOOTER & CONFLICTS ───────────────────────────────────────── */}
        <div className="bg-muted/20 border-t border-border/40">
          {conflicts.length > 0 && (
            <div className="px-8 py-3 bg-destructive/10 border-b border-destructive/20 flex items-start gap-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <p className="leading-snug">
                <span className="font-semibold">Conflict:</span> {conflicts[0].mods}+{conflicts[0].key} is already bound to <code className="font-mono bg-destructive/20 px-1 py-0.5 rounded text-xs font-bold">{conflicts[0].func}</code> in this context. Saving will override it.
              </p>
            </div>
          )}
          
          <div className="flex items-center justify-end gap-3 px-8 py-5">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="px-5">
              Cancel
            </Button>
            <Button 
              className="px-8 shadow-sm font-medium" 
              disabled={!key || !func || Object.values(argErrors).some(Boolean)}
              onClick={handleSubmit}
            >
              {editingEntry ? "Update Shortcut" : "Save Shortcut"}
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}

// ─── ACTION SELECTOR (Combobox inside Popover) ───────────────────────────

function ActionSelectCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const categories = useMemo(() => getDispatchersByCategory(), []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-12 text-sm font-normal hover:bg-muted/50 hover:text-foreground px-4 focus-visible:ring-1 focus-visible:ring-ring"
        >
          <div className="flex items-center gap-3 truncate">
            <CmdIcon className="size-4 text-muted-foreground shrink-0" />
            {value ? (
              <span className="font-mono font-medium truncate">{value}</span>
            ) : (
              <span className="text-muted-foreground truncate">Select a system action or command...</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-lg shadow-lg border-border/50" align="start" sideOffset={4}>
        <Command className="border-0 bg-popover">
          <CommandInput placeholder="Search dispatchers..." className="h-10 text-sm focus:ring-0" />
          <CommandList className="max-h-[280px]">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No actions found.</CommandEmpty>
            {categories.map(([cat, items]) => (
              <CommandGroup key={cat} heading={<span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">{cat}</span>}>
                {items.map((d) => (
                  <CommandItem
                    key={d.name}
                    value={`${d.name} ${d.description}`}
                    onSelect={() => {
                      onChange(d.name);
                      setOpen(false);
                    }}
                    className="flex flex-col items-start py-2.5 cursor-pointer"
                  >
                    <div className="flex items-center w-full">
                      <span className="font-mono text-sm font-medium">{d.name}</span>
                      {value === d.name && <Check className="ml-auto h-4 w-4 text-primary" />}
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-1 mt-1">{d.description}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── DYNAMIC ARGUMENTS ───────────────────────────────────────────────────

function DynamicArgField({ arg, value, error, onChange }: { arg: DispatcherArg; value: string; error: string | null; onChange: (v: string) => void }) {
  const id = `arg-${arg.name}`;

  if (arg.type === "command") {
    return (
      <div className="group flex flex-col px-4 py-3 transition-colors hover:bg-accent/50 focus-within:bg-accent/50">
        <div className="flex items-start gap-3">
          <span className="mt-1.5 text-muted-foreground/25 font-mono text-sm select-none shrink-0">$</span>
          <div className="flex-1 min-w-0">
            <textarea
              id={id}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={arg.placeholder || `Enter ${arg.label}...`}
              className="w-full bg-transparent py-1 font-mono text-[13px] text-foreground outline-none resize-y min-h-[2.5rem] leading-relaxed placeholder:text-muted-foreground/40"
              spellCheck={false}
              rows={2}
            />
          </div>
          {error && (
            <span className="text-[11px] text-destructive font-medium shrink-0 mt-1.5">{error}</span>
          )}
        </div>
        {arg.description && (
          <div className="ml-7 mt-0.5">
            <span className="text-[11px] text-muted-foreground/60">{arg.description}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="group flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent/50 focus-within:bg-accent/50">
      <div className="flex flex-col min-w-0 pr-2">
        <Label htmlFor={id} className="text-[13px] font-medium text-foreground font-mono leading-snug">
          {arg.label}
          {arg.required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {arg.description && (
          <span className="text-[11px] text-muted-foreground/60 truncate mt-0.5">{arg.description}</span>
        )}
        {error && (
          <span className="text-[11px] text-destructive font-medium mt-0.5">{error}</span>
        )}
      </div>
      <div className="shrink-0">
        {arg.options ? (
          <Select value={value || "__none__"} onValueChange={(v) => v !== "__none__" && onChange(v)}>
            <SelectTrigger id={id} className="h-8 w-[160px] text-xs font-mono bg-background border-border/60">
              <SelectValue placeholder={arg.placeholder || "Select"} />
            </SelectTrigger>
            <SelectContent>
              {arg.options.map((opt) => (
                <SelectItem key={opt} value={opt} className="text-xs font-mono">{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : arg.type === "float" ? (
          <div className="flex items-center gap-3 w-[200px]">
            <Slider
              value={[value ? Number(value) : 0]}
              min={arg.min ?? 0}
              max={arg.max ?? 1}
              step={arg.step ?? 0.01}
              onValueChange={(v) => onChange(String(v[0]))}
              className="flex-1"
            />
            <Input
              id={id}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={arg.placeholder}
              className={cn(
                "h-8 w-16 text-center text-xs font-mono bg-background border-border/60",
                error && "border-destructive/60"
              )}
            />
          </div>
        ) : (
          <Input
            id={id}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={arg.placeholder}
            className={cn(
              "h-8 w-[200px] text-xs font-mono bg-background border-border/60",
              error && "border-destructive/60"
            )}
          />
        )}
      </div>
    </div>
  );
}
