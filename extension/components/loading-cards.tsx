import { useEffect, useState } from "react";

const STEPS = ["Reading the post", "Finding the best angles", "Writing comment options"];

function Bar({ w }: { w: string }) {
  return (
    <div
      className="h-3 animate-shimmer rounded bg-[length:200%_100%] bg-gradient-to-r from-muted via-border to-muted"
      style={{ width: w }}
    />
  );
}

export function LoadingCards({ count, step }: { count: number; step: number }) {
  return (
    <div className="space-y-2.5" aria-live="polite" aria-busy>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
        {STEPS[Math.min(step, STEPS.length - 1)]}…
      </div>
      {Array.from({ length: Math.min(count, 3) }, (_, i) => (
        <div key={i} className="space-y-2 rounded-xl border bg-card p-3" style={{ opacity: 1 - i * 0.22 }}>
          <Bar w="28%" />
          <Bar w="96%" />
          <Bar w="82%" />
        </div>
      ))}
    </div>
  );
}

/** Advances through the loading messages while a request is in flight. */
export function useLoadingStep(active: boolean) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) {
      setStep(0);
      return;
    }
    const timers = [setTimeout(() => setStep(1), 1400), setTimeout(() => setStep(2), 3200)];
    return () => timers.forEach(clearTimeout);
  }, [active]);
  return step;
}
