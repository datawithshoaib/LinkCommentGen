import { cn } from "@/lib/utils";

interface PillOption<T extends string> {
  value: T;
  label: string;
  emoji?: string;
}

interface PillGroupProps<T extends string> {
  options: readonly PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  scroll?: boolean;
  size?: "sm" | "md";
  ariaLabel: string;
}

/** A row of selectable pills (single choice). */
export function PillGroup<T extends string>({
  options,
  value,
  onChange,
  disabled,
  scroll,
  size = "md",
  ariaLabel,
}: PillGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "flex gap-1.5",
        scroll ? "-mx-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "flex-wrap",
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border font-medium whitespace-nowrap transition-all",
              "focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-background text-foreground/80 hover:border-primary/50 hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {o.emoji && <span aria-hidden>{o.emoji}</span>}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
