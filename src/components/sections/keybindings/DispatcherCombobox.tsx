import { useState, useRef, useEffect, useMemo } from "react";
import { Command } from "cmdk";
import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { getDispatchersByCategory } from "@/lib/dispatchers";

interface DispatcherComboboxProps {
  value: string;
  onChange: (val: string) => void;
}

export function DispatcherCombobox({ value, onChange }: DispatcherComboboxProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const categories = useMemo(() => getDispatchersByCategory(), []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-md border border-border/50 bg-background px-3 py-2 text-sm font-mono shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-ring/50"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground/60"}>
          {value || "Search actions…"}
        </span>
        <ChevronDownIcon className="size-4 text-muted-foreground/50" />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+4px)] z-50 w-full overflow-hidden rounded-xl border border-border/50 bg-popover shadow-xl animate-in fade-in zoom-in-95 duration-100">
          <Command className="flex flex-col overflow-hidden bg-transparent">
            <div className="flex items-center gap-2 border-b border-border/30 px-3 py-2">
              <SearchIcon className="size-4 text-muted-foreground/50" aria-hidden="true" />
              <Command.Input
                autoFocus
                placeholder="Search dispatchers…"
                className="flex-1 bg-transparent text-sm font-mono outline-none placeholder:text-muted-foreground/40"
              />
            </div>
            <Command.List className="max-h-[260px] overflow-y-auto p-1">
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                No action found.
              </Command.Empty>
              {categories.map(([cat, items]) => (
                <Command.Group
                  key={cat}
                  heading={
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                      {cat}
                    </div>
                  }
                >
                  {items.map((d) => (
                    <Command.Item
                      key={d.name}
                      value={`${d.name} ${d.description}`}
                      onSelect={() => {
                        onChange(d.name);
                        setOpen(false);
                      }}
                      className="flex cursor-pointer flex-col gap-0.5 rounded-md px-2 py-1.5 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground transition-colors"
                    >
                      <span className="font-mono text-sm font-medium">{d.name}</span>
                      <span className="text-[11px] text-muted-foreground/70 line-clamp-1">
                        {d.description}
                      </span>
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
