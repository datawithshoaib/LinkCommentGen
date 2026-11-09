import { useState } from "react";
import { Check, Copy, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommentOption } from "@/lib/types";

interface CommentCardProps {
  option: CommentOption;
  index: number;
  /** Primary action. When omitted the card only offers copy. */
  onUse?: (text: string) => void;
  useLabel?: string;
  selected?: boolean;
}

export function CommentCard({ option, index, onUse, useLabel = "Insert", selected }: CommentCardProps) {
  const [copied, setCopied] = useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(option.text);
    } catch {
      // Clipboard API can be blocked on some pages; fall back to a hidden textarea.
      const ta = document.createElement("textarea");
      ta.value = option.text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const words = option.text.trim().split(/\s+/).length;

  return (
    <div
      role={onUse ? "button" : undefined}
      tabIndex={onUse ? 0 : undefined}
      onClick={() => onUse?.(option.text)}
      onKeyDown={(e) => {
        if (onUse && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onUse(option.text);
        }
      }}
      style={{ animationDelay: `${index * 60}ms` }}
      className={cn(
        "group relative animate-fade-in-up rounded-xl border bg-card p-3 text-card-foreground transition-all",
        onUse &&
          "cursor-pointer hover:-translate-y-px hover:border-primary/60 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
        selected && "border-primary ring-2 ring-primary/25",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
          {option.angle}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">{words} words</span>
      </div>

      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{option.text}</p>

      <div className="mt-2.5 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Copy comment"
        >
          {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
        {onUse && (
          <span
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-semibold transition-colors",
              selected
                ? "bg-green-600 text-white"
                : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
            )}
          >
            {selected ? <Check className="size-3.5" /> : <CornerDownLeft className="size-3.5" />}
            {selected ? "Inserted" : useLabel}
          </span>
        )}
      </div>
    </div>
  );
}
