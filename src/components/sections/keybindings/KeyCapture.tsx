import { useState, useRef, useEffect, useCallback } from "react";
import { SearchIcon, ChevronDownIcon, ArrowLeftIcon } from "lucide-react";
import { Command } from "cmdk";
import { useKeyRecorder } from "@/lib/key-recorder";
import { xkbToDisplay } from "@/lib/key-name-map";
import { cn } from "@/lib/utils";
import { KEY_GROUPS } from "./key-names";
import type { KeyGroup } from "./key-names";

interface KeyCaptureProps {
  value: string;
  onChange: (val: string) => void;
}

function flattenKeys(
  groups: KeyGroup[],
): { name: string; groupLabel: string; searchValue: string }[] {
  const flat: { name: string; groupLabel: string; searchValue: string }[] = [];
  for (const group of groups) {
    for (const key of group.keys) {
      const aliases = key.aliases?.join(" ") ?? "";
      flat.push({
        name: key.name,
        groupLabel: group.label,
        searchValue: `${key.name} ${aliases}`,
      });
    }
  }
  return flat;
}

const ALL_KEYS = flattenKeys(KEY_GROUPS);

/** Mode within the dropdown: recording (default) or searching */
type DropdownMode = "record" | "search";

export function KeyCapture({ value, onChange }: KeyCaptureProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DropdownMode>("record");
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Key recorder — active only in "record" mode ──
  const keyRecorder = useKeyRecorder(
    useCallback(
      (combo: { key: string }) => {
        onChange(combo.key);
        setOpen(false);
      },
      [onChange],
    ),
  );
  const captureInputRef = useRef<HTMLInputElement>(null);

  // Focus the right element when mode changes
  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    const id = setTimeout(() => {
      if (mode === "record") {
        keyRecorder.start();
        captureInputRef.current?.focus();
      } else {
        searchInputRef.current?.focus();
      }
    }, 0);
    return () => clearTimeout(id);
  }, [open, mode, keyRecorder]);



  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Filtered key groups for search mode
  const grouped = (() => {
    if (mode === "record" || !search.trim()) return KEY_GROUPS;
    const lower = search.toLowerCase();
    const matching = new Set(
      ALL_KEYS.filter((k) => k.searchValue.toLowerCase().includes(lower)).map((k) => k.name),
    );
    return KEY_GROUPS.map((g) => ({
      ...g,
      keys: g.keys.filter((k) => matching.has(k.name)),
    })).filter((g) => g.keys.length > 0);
  })();

  return (
    <div className="relative" ref={containerRef}>
      {/* ── Trigger button ── */}
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) setMode("record");
        }}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors",
          value
            ? "border-border bg-background hover:border-border/80"
            : "border-dashed border-muted-foreground/30 bg-background hover:border-muted-foreground/50",
        )}
      >
        {value ? (
          <kbd className="inline-flex items-center justify-center h-[26px] min-w-[26px] px-2 rounded-[5px] font-mono text-xs font-semibold leading-none border border-border bg-muted text-foreground select-none shadow-[0_1px_0_0_hsl(var(--border))]">
            {xkbToDisplay(value)}
          </kbd>
        ) : (
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
        )}
        <span
          className={cn(
            "text-xs flex-1 text-left",
            value ? "text-muted-foreground/50" : "text-muted-foreground/60",
          )}
        >
          {value ? "Click to change" : "Select a key…"}
        </span>
        <ChevronDownIcon className="size-4 text-muted-foreground/50 shrink-0" />
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-full">
          <div className="rounded-xl border border-border/50 bg-popover shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <Command className="flex flex-col overflow-hidden bg-transparent">
              {/* ── Top bar: record or search ── */}
              {mode === "record" ? (
                <div className="flex items-center gap-2 border-b border-primary/30 bg-primary/5 px-3 py-2.5">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  <span className="text-xs text-muted-foreground flex-1">
                    Press a key on your keyboard…
                  </span>
                  <button
                    type="button"
                    onClick={() => setMode("search")}
                    className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground/50 hover:text-foreground transition-colors shrink-0 border border-border/50 rounded-md px-2 py-1"
                    title="Search key list"
                  >
                    <SearchIcon className="size-3" />
                    Search
                  </button>

                  {/* Hidden capture input — receives key events when recording */}
                  <input
                    ref={captureInputRef}
                    className="sr-only"
                    aria-label="Key capture input"
                    onKeyDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.key === "Escape") {
                        setOpen(false);
                        return;
                      }
                      keyRecorder.handleKeyEvent(e.nativeEvent);
                    }}
                    onBlur={() => {
                      // Don't cancel recording on blur — the hidden input can lose
                      // focus to the search button click without issue.
                    }}
                    readOnly
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 border-b border-border/30 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setMode("record")}
                    className="text-muted-foreground/40 hover:text-foreground transition-colors shrink-0"
                    title="Back to recording"
                  >
                    <ArrowLeftIcon className="size-4" />
                  </button>
                  <SearchIcon
                    className="size-4 text-muted-foreground/50 shrink-0"
                    aria-hidden="true"
                  />
                  <Command.Input
                    ref={searchInputRef}
                    value={search}
                    onValueChange={setSearch}
                    placeholder="Search keys…"
                    className="flex-1 bg-transparent text-sm font-mono outline-none placeholder:text-muted-foreground/40"
                  />
                </div>
              )}

              {/* ── Key list ── */}
              <Command.List className="max-h-[260px] overflow-y-auto p-1">
                <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                  {mode === "record"
                    ? "Press any key to capture it"
                    : "No key found."}
                </Command.Empty>
                {grouped.map((group) => (
                  <Command.Group
                    key={group.label}
                    heading={
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                        {group.label}
                      </div>
                    }
                  >
                    {group.keys.map((keyInfo) => (
                      <Command.Item
                        key={keyInfo.name}
                        value={keyInfo.name}
                        onSelect={() => {
                          onChange(keyInfo.name);
                          setOpen(false);
                        }}
                        className="flex cursor-pointer items-center rounded-md px-2 py-1.5 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground transition-colors"
                      >
                        <span className="font-mono text-sm font-medium">
                          {keyInfo.name}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
              </Command.List>
            </Command>
          </div>
        </div>
      )}
    </div>
  );
}
