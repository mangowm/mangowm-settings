import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Terminal, Settings2, Command, SearchIcon } from "lucide-react";
import { useKeyRecorder } from "@/lib/key-recorder";
import { xkbToDisplay } from "@/lib/key-name-map";
import type { SourceFile } from "@/lib/config-types";
import type { KeybindEntry, KeybindFlags } from "@/lib/keybind-types";
import { cn } from "@/lib/utils";
import { bindKeyFromFlags, serializeModifiers, parseModifiers } from "@/lib/keybind-parse";
import { DispatcherCombobox } from "./DispatcherCombobox";
import { KeyCombobox } from "./KeyCombobox";
import type { DispatcherArg } from "@/lib/dispatchers";
import {
  DISPATCHER_MAP,
  DIRECTION_OPTS,
  CIRCLE_DIR_OPTS,
  LAYOUT_NAMES,
  MOUSE_ACTION_OPTS,
  TAG_NUMBERS,
  BOOL_FLAGS,
  DIR_LABELS,
  CIRCLE_DIR_LABELS,
  MOUSE_LABELS,
  BOOL_LABELS,
  TAG_LABELS,
  parseArgValues,
  serializeArgValues,
  validateAllArgs,
} from "@/lib/dispatchers";

const MODIFIERS = ["super", "ctrl", "alt", "shift"];
const MODIFIER_ORDER = ["super", "ctrl", "alt", "shift"];

/** Conflict candidates: entries sharing the same (configKey, mode, mods, key)
 *  but with a different identity than the entry currently being edited.
 *  Uses stable `id` for self-comparison, immune to index shifts. */
function findConflicts(
  allEntries: KeybindEntry[],
  configKey: string,
  mode: string,
  mods: string,
  key: string,
  editingEntry?: KeybindEntry | null,
): KeybindEntry[] {
  return allEntries.filter((e) => {
    if (editingEntry && e.id === editingEntry.id) return false;
    return e.configKey === configKey && e.mode === mode && e.mods === mods && e.key === key;
  });
}

// ── ArgField — renders the correct input for a single DispatcherArg ──────

interface ArgFieldProps {
  arg: DispatcherArg;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}

function SelectArg({
  id,
  value,
  onChange,
  placeholder,
  options,
  labels,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  options: readonly string[];
  labels: Record<string, string>;
}) {
  return (
    <Select value={value || "__unset__"} onValueChange={(v) => { if (v && v !== "__unset__") onChange(v); }}>
      <SelectTrigger id={id} className="w-full font-mono text-sm">
        <SelectValue placeholder={placeholder ?? "—"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {labels[opt] ?? opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ArgField({ arg, value, error, onChange }: ArgFieldProps) {
  const id = `arg-${arg.name}`;
  const sharedInputProps = {
    id,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    placeholder: arg.placeholder,
    spellCheck: false as const,
    "aria-label": arg.label,
    "aria-invalid": !!error || undefined,
    className: cn(
      "w-full font-mono text-sm",
      error && "border-destructive/60 focus-visible:ring-destructive/30",
    ),
  } as const;

  let input: React.ReactNode;

  switch (arg.type) {
    case "direction":
      input = (
        <SelectArg
          id={id}
          value={value}
          onChange={onChange}
          options={DIRECTION_OPTS}
          labels={DIR_LABELS}
        />
      );
      break;
    case "circle-dir":
      input = (
        <SelectArg
          id={id}
          value={value}
          onChange={onChange}
          options={CIRCLE_DIR_OPTS}
          labels={CIRCLE_DIR_LABELS}
        />
      );
      break;
    case "layout":
      input = (
        <Select value={value || "__unset__"} onValueChange={(v) => { if (v && v !== "__unset__") onChange(v); }}>
          <SelectTrigger id={id} className="w-full font-mono text-sm">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {LAYOUT_NAMES.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      break;
    case "tag":
      input = (
        <SelectArg
          id={id}
          value={value}
          onChange={onChange}
          options={TAG_NUMBERS}
          labels={TAG_LABELS}
        />
      );
      break;
    case "bool-flag":
      input = (
        <SelectArg
          id={id}
          value={value}
          onChange={onChange}
          options={BOOL_FLAGS}
          labels={BOOL_LABELS}
        />
      );
      break;
    case "mouse-action":
      input = (
        <SelectArg
          id={id}
          value={value}
          onChange={onChange}
          options={MOUSE_ACTION_OPTS}
          labels={MOUSE_LABELS}
        />
      );
      break;
    case "int":
    case "uint":
      input = <Input type="text" {...sharedInputProps} />;
      break;
    case "float":
      input = (
        <div className="flex items-center gap-3">
          <Slider
            value={[value ? Number(value) : 0]}
            min={arg.min ?? 0}
            max={arg.max ?? 1}
            step={arg.step ?? 0.01}
            onValueChange={(val: number | readonly number[]) => { const v = typeof val === "number" ? val : val[0]; onChange(String(v)); }}
            className="flex-1"
            aria-label={arg.label}
          />
          <Input
            type="text"
            {...sharedInputProps}
            className={cn(sharedInputProps.className, "w-20 shrink-0 text-center")}
          />
        </div>
      );
      break;
    case "command":
      input = (
        <textarea
          {...sharedInputProps}
          className={cn(sharedInputProps.className, "min-h-[60px] resize-y rounded-lg border border-input bg-transparent px-3 py-2 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50")}
        />
      );
      break;
    case "tag-mask":
      input = <Input type="text" {...sharedInputProps} />;
      break;
    default:
      input = <Input type="text" {...sharedInputProps} />;
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
        {arg.label}
        {arg.required && <span className="text-red-400">*</span>}
        <span className="text-[10px] text-muted-foreground/50 font-normal">
          {arg.description}
        </span>
      </label>
      {input}
      {error && (
        <p className="text-[11px] text-red-500/80 mt-1">{error}</p>
      )}
    </div>
  );
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
  const [argErrors, setArgErrors] = useState<Record<string, string | null>>({});

  // ── Key capture (shared hook, key-only mode — modifiers from buttons) ──
  const keyRecorder = useKeyRecorder(
    useCallback((combo) => {
      setKey(combo.key);
    }, []),
  );
  const keyCaptureRef = useRef<HTMLInputElement>(null);
  const [showKeyBrowser, setShowKeyBrowser] = useState(false);
  const keyBrowserRef = useRef<HTMLDivElement>(null);

  // Click outside to close key browser
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (keyBrowserRef.current && !keyBrowserRef.current.contains(e.target as Node))
        setShowKeyBrowser(false);
    }
    if (showKeyBrowser) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showKeyBrowser]);

  // Auto-focus the hidden capture input when recording starts
  useEffect(() => {
    if (keyRecorder.status === "recording") {
      const id = setTimeout(() => keyCaptureRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [keyRecorder.status]);

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

  const currentSchema = useMemo<DispatcherArg[]>(
    () => DISPATCHER_MAP.get(func)?.args ?? [],
    [func],
  );

  // Split the comma-separated args string into named values per schema.
  // Re-parsed whenever the dispatcher (schema) or raw args string changes.
  const [argValues, setArgValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setArgValues(parseArgValues(args, currentSchema));
  }, [args, currentSchema]);

  const modString = useMemo(() => {
    const sorted = [...selectedMods].sort(
      (a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b),
    );
    return serializeModifiers(sorted);
  }, [selectedMods]);

  // ── Arg change handler ────────────────────────────────────────────────────

  const handleArgChange = useCallback(
    (argName: string, value: string) => {
      setArgValues((prev) => {
        const next = { ...prev, [argName]: value };
        setArgs(serializeArgValues(next, currentSchema));

        // Validate on every change (clear error once fixed).
        const schema = currentSchema.find((a) => a.name === argName);
        if (schema) {
          const err = validateAllArgs(next, currentSchema);
          setArgErrors((prevErr) =>
            err[argName] !== prevErr[argName]
              ? { ...prevErr, [argName]: err[argName] ?? null }
              : prevErr,
          );
        }

        return next;
      });
    },
    [currentSchema],
  );

  // Re-resolve the editing entry from the current allEntries by stable
  // id so that index shifts from concurrent panel edits don't corrupt
  // the conflict check or the submission target.
  const resolvedEditing = useMemo(() => {
    if (!editingEntry) return null;
    return allEntries.find((e) => e.id === editingEntry.id) ?? null;
  }, [allEntries, editingEntry]);

  const conflicts = useMemo(() => {
    if (!key.trim()) return [];
    return findConflicts(allEntries, configKey, mode, modString, key.trim(), resolvedEditing);
  }, [allEntries, configKey, mode, modString, key, resolvedEditing]);

  // Returns true if the given mode name already has at least one
  // `keymode=` declaration anywhere in the loaded config files.
  // This prevents inserting duplicate `keymode=resize` lines when the
  // user adds multiple bindings to the same mode block.
  const modeExistsInFiles = useCallback(
    (mode: string): boolean => {
      for (const file of files) {
        const modes = file.data["keymode"];
        if (modes && modes.some((m) => m === mode)) return true;
      }
      return false;
    },
    [files],
  );

  const addModeAwareEntry = useCallback(
    (configKey: string, value: string) => {
      // Only emit a `keymode=` directive if the target mode has never
      // been declared before.  If it already exists, the binding's mode
      // context is inferred from the nearest preceding `keymode=` line
      // and tracked in KeybindEntry.mode for the UI.
      if (!modeExistsInFiles(mode)) {
        addEntry("keymode", mode);
      }
      addEntry(configKey, value);
    },
    [mode, modeExistsInFiles, addEntry],
  );

  const handleSubmit = () => {
    if (!key.trim() || !func.trim()) return;

    // Validate all args before submitting
    const errors = validateAllArgs(argValues, currentSchema);
    setArgErrors(errors);
    const hasErrors = Object.values(errors).some(Boolean);
    if (hasErrors) return;

    const value = [modString, key.trim(), func.trim(), args.trim()].filter(Boolean).join(",");

    // Use the re-resolved entry (stable id lookup) so that index
    // shifts from concurrent panel edits don't corrupt the target.
    const target = resolvedEditing ?? editingEntry;
    if (target) {
      const keyChanged = configKey !== target.configKey;
      const modeChanged = mode !== target.mode;
      if (keyChanged || modeChanged) {
        removeEntry(target.configKey, target.configIndex);
        addModeAwareEntry(configKey, value);
      } else {
        updateEntry(target.configKey, target.configIndex, value);
      }
    } else {
      addModeAwareEntry(configKey, value);
    }

    onOpenChange(false);
  };

  const hasConflict = conflicts.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl sm:max-w-4xl gap-8 p-8">
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
              <div className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-4">
                {/* ── Modifier buttons ── */}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2">
                    Modifiers
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {MODIFIERS.map((m) => (
                      <button
                        key={m}
                        onClick={() =>
                          setSelectedMods((p) =>
                            p.includes(m) ? p.filter((x) => x !== m) : [...p, m],
                          )
                        }
                        type="button"
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
                </div>

                {/* ── Key capture area ── */}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2">
                    Key
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={
                          keyRecorder.status === "recording"
                            ? undefined
                            : keyRecorder.start
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            keyRecorder.start();
                        }}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors cursor-pointer select-none",
                          keyRecorder.status === "recording"
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : key
                              ? "border-border bg-background hover:border-border/80"
                              : "border-dashed border-muted-foreground/30 bg-background hover:border-muted-foreground/50",
                        )}
                      >
                        {keyRecorder.status === "recording" ? (
                          <>
                            <span className="relative flex h-2 w-2 flex-shrink-0">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                            </span>
                            <span className="text-xs text-muted-foreground flex-1">
                              Press a key on your keyboard…
                            </span>
                            <kbd className="text-[10px] text-muted-foreground/50 border border-border rounded px-1">
                              Esc to cancel
                            </kbd>
                          </>
                        ) : key ? (
                          <>
                            <kbd className="inline-flex items-center justify-center h-[26px] min-w-[26px] px-2 rounded-[5px] font-mono text-xs font-semibold leading-none border border-border bg-muted text-foreground select-none shadow-[0_1px_0_0_hsl(var(--border))]">
                              {xkbToDisplay(key)}
                            </kbd>
                            <span className="text-xs text-muted-foreground/50 ml-2">
                              Click to change
                            </span>
                            <div className="flex-1" />
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="text-muted-foreground/30 shrink-0"
                            >
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                            </svg>
                          </>
                        ) : (
                          <>
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="text-muted-foreground/40 shrink-0"
                              aria-hidden="true"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            <span className="text-xs text-muted-foreground/60 flex-1">
                              Click to record key…
                            </span>
                          </>
                        )}
                      </div>

                      {/* Hidden input that captures key events */}
                      <input
                        ref={keyCaptureRef}
                        className="sr-only"
                        aria-label="Key capture input"
                        onKeyDown={(e) => {
                          if (keyRecorder.status === "recording") {
                            e.preventDefault();
                            e.stopPropagation();
                            keyRecorder.handleKeyEvent(e.nativeEvent);
                          }
                        }}
                        onBlur={() => {
                          if (keyRecorder.status === "recording") {
                            keyRecorder.cancel();
                          }
                        }}
                        readOnly
                      />
                    </div>

                    {/* Fallback: search all XKB keys */}
                    <div className="relative shrink-0" ref={keyBrowserRef}>
                      <button
                        type="button"
                        onClick={() => setShowKeyBrowser((o) => !o)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/50 bg-background text-muted-foreground/40 hover:text-foreground hover:border-border transition-colors"
                        title="Browse all keys"
                      >
                        <SearchIcon className="size-4" />
                      </button>
                      {showKeyBrowser && (
                        <div className="absolute right-0 top-[calc(100%+4px)] z-50 w-72">
                          <KeyCombobox
                            value={key}
                            onChange={(val) => {
                              setKey(val);
                              setShowKeyBrowser(false);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Terminal className="size-4 text-muted-foreground" /> Dispatcher &amp; Arguments
              </label>
              <div className="flex flex-col gap-4">
                <DispatcherCombobox value={func} onChange={setFunc} />
                {currentSchema.length > 0 ? (
                  <div className="space-y-3">
                    {currentSchema.map((arg) => (
                      <ArgField
                        key={arg.name}
                        arg={arg}
                        value={argValues[arg.name] ?? ""}
                        error={argErrors[arg.name] ?? null}
                        onChange={(v) => handleArgChange(arg.name, v)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/50 italic px-1">
                    This action takes no arguments.
                  </p>
                )}
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
            disabled={!key || !func || Object.values(argErrors).some(Boolean)}
            className="px-8 shadow-md"
          >
            {isEditing ? "Update Binding" : "Save Binding"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
