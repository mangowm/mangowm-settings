import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Trash2, Lock, ArrowUpFromLine, Terminal } from "lucide-react";
import type { KeybindEntry } from "@/lib/keybind-types";
import { parseModifiers } from "@/lib/keybind-parse";
import { MANGO_DISPATCHERS } from "@/lib/dispatchers";

function Kbd({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <kbd
      className={`px-1.5 py-0.5 rounded-md border-b-[2px] border font-mono text-[10px] font-bold uppercase tracking-wider ${
        primary
          ? "bg-primary text-primary-foreground border-primary-foreground/20"
          : "bg-muted border-border/80 text-muted-foreground"
      }`}
    >
      {children}
    </kbd>
  );
}

export function KeybindItem({
  entry,
  onEdit,
  onDelete,
}: {
  entry: KeybindEntry;
  onEdit: (entry: KeybindEntry) => void;
  onDelete: (entry: KeybindEntry) => void;
}) {
  const mods = parseModifiers(entry.mods);
  const desc = MANGO_DISPATCHERS.find((d) => d.name === entry.func)?.description;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onEdit(entry);
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onDelete(entry);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(entry)}
      onKeyDown={handleKeyDown}
      className="group relative flex items-start justify-between gap-4 px-4 py-2.5 rounded-lg transition-colors hover:bg-accent/50 focus-within:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 cursor-pointer"
      aria-label={`${entry.mods ? entry.mods + "+" : ""}${entry.key} → ${entry.func}${
        desc ? `: ${desc}` : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="flex items-center gap-1 shrink-0">
            {mods.map((m) => <Kbd key={m}>{m}</Kbd>)}
            {mods.length > 0 && (
              <span className="text-muted-foreground/30 text-[10px] px-0.5">+</span>
            )}
            <Kbd primary>{entry.key}</Kbd>
          </div>

          <span className="text-muted-foreground/20 text-xs hidden sm:inline">→</span>

          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-0.5 font-mono text-[12px] font-semibold text-primary">
              {entry.func}
            </span>

            <div className="flex items-center gap-0.5">
              {entry.flags.lock && (
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex" />}>
                    <Lock className="size-3 text-amber-500/60" />
                  </TooltipTrigger>
                  <TooltipContent side="top">Works on Lockscreen</TooltipContent>
                </Tooltip>
              )}
              {entry.flags.release && (
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex" />}>
                    <ArrowUpFromLine className="size-3 text-blue-500/60" />
                  </TooltipTrigger>
                  <TooltipContent side="top">Triggers on Release</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        {desc && (
          <p className="text-[12px] text-muted-foreground/60 leading-tight">{desc}</p>
        )}

        {entry.args && (
          <div className="flex items-start gap-2 rounded-md bg-muted/40 px-2.5 py-1.5">
            <Terminal className="size-3 text-muted-foreground/40 mt-0.5 shrink-0" />
            <code className="font-mono text-[12px] leading-relaxed text-muted-foreground/80 break-words whitespace-pre-wrap">
              {entry.args}
            </code>
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(entry);
        }}
        className="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
        aria-label="Remove binding"
        title="Remove binding"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
