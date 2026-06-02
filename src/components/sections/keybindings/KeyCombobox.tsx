import { useState, useRef, useEffect, useMemo } from "react";
import { Command } from "cmdk";
import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { KEY_GROUPS } from "./key-names";
import type { KeyGroup } from "./key-names";

interface KeyComboboxProps {
  value: string;
  onChange: (val: string) => void;
}

function flattenKeys(groups: KeyGroup[]): { name: string; groupLabel: string; searchValue: string }[] {
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

export function KeyCombobox({ value, onChange }: KeyComboboxProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const grouped = useMemo(() => {
    if (!search.trim()) return KEY_GROUPS;
    const lower = search.toLowerCase();
    const matching = new Set(
      ALL_KEYS
        .filter((k) => k.searchValue.toLowerCase().includes(lower))
        .map((k) => k.name)
    );
    return KEY_GROUPS
      .map((g) => ({
        ...g,
        keys: g.keys.filter((k) => matching.has(k.name)),
      }))
      .filter((g) => g.keys.length > 0);
  }, [search]);

  const displayLabel = value || "Select a key…";

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setSearch("");
          if (!open) {
            requestAnimationFrame(() => inputRef.current?.focus());
          }
        }}
        className="flex w-full items-center justify-between rounded-md border border-border/50 bg-background px-3 py-2 text-sm font-mono shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-ring/50"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground/60"}>
          {displayLabel}
        </span>
        <ChevronDownIcon className="size-4 text-muted-foreground/50" />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+4px)] z-50 w-full overflow-hidden rounded-xl border border-border/50 bg-popover shadow-xl animate-in fade-in zoom-in-95 duration-100">
          <Command className="flex flex-col overflow-hidden bg-transparent">
            <div className="flex items-center gap-2 border-b border-border/30 px-3 py-2">
              <SearchIcon className="size-4 text-muted-foreground/50" aria-hidden="true" />
              <Command.Input
                ref={inputRef}
                value={search}
                onValueChange={setSearch}
                placeholder="Search keys…"
                className="flex-1 bg-transparent text-sm font-mono outline-none placeholder:text-muted-foreground/40"
              />
            </div>
            <Command.List className="max-h-[260px] overflow-y-auto p-1">
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                No key found.
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
                        setSearch("");
                      }}
                      className="flex cursor-pointer items-center rounded-md px-2 py-1.5 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground transition-colors"
                    >
                      <span className="font-mono text-sm font-medium">{keyInfo.name}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </div>
      )}
    </div>
  );
}
