import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ChevronDown, RefreshCw, Sparkles, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { CommentCard } from "@/components/comment-card";
import { LoadingCards, useLoadingStep } from "@/components/loading-cards";
import { PillGroup } from "@/components/pill-group";
import { generateComments, optionsFromSettings } from "@/lib/api";
import { getSettings, updateSettings, type Settings } from "@/lib/settings";
import { LENGTHS, TONES, type GenerateResponse, type Length, type PostContext, type Tone } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Results survive the panel being unmounted (e.g. comment box closed and reopened). */
const resultCache = new Map<string, GenerateResponse>();

interface CommentPanelProps {
  getPost: () => PostContext;
  getKey: (post: PostContext) => string;
  onInsert: (text: string) => void;
  onDismiss: () => void;
  dark: boolean;
}

type Status = "idle" | "loading" | "done" | "error";

export function CommentPanel({ getPost, getKey, onInsert, onDismiss, dark }: CommentPanelProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tone, setTone] = useState<Tone>("professional");
  const [length, setLength] = useState<Length>("medium");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState("");
  const [inserted, setInserted] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const requestId = useRef(0);
  const step = useLoadingStep(status === "loading");

  const run = useCallback(
    async (opts: { tone: Tone; length: Length; force?: boolean }, s: Settings) => {
      const post = getPost();
      if (post.post_text.length < 10) {
        setStatus("error");
        setError("Couldn't read this post's text. Try opening the post on its own page, or use the popup to paste it.");
        return;
      }
      const key = `${getKey(post)}|${opts.tone}|${opts.length}|${s.count}`;
      const cached = resultCache.get(key);
      if (cached && !opts.force) {
        setResult(cached);
        setStatus("done");
        return;
      }

      const id = ++requestId.current;
      setStatus("loading");
      setInserted(null);
      setError("");
      try {
        const res = await generateComments(post, { ...optionsFromSettings(s), tone: opts.tone, length: opts.length });
        if (id !== requestId.current) return; // superseded by a newer request
        resultCache.set(key, res);
        setResult(res);
        setStatus("done");
      } catch (e) {
        if (id !== requestId.current) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    },
    [getPost, getKey],
  );

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setTone(s.tone);
      setLength(s.length);
      if (s.autoGenerate) run({ tone: s.tone, length: s.length }, s);
    });
  }, [run]);

  const regenerate = (next: Partial<{ tone: Tone; length: Length }> = {}, force = true) => {
    if (!settings) return;
    const t = next.tone ?? tone;
    const l = next.length ?? length;
    setTone(t);
    setLength(l);
    setCollapsed(false);
    run({ tone: t, length: l, force }, settings);
  };

  const changeTone = (t: Tone) => {
    regenerate({ tone: t }, false);
    void updateSettings({ tone: t }); // remember the user's preferred tone
  };

  const changeLength = (l: Length) => {
    regenerate({ length: l }, false);
    void updateSettings({ length: l });
  };

  const use = (i: number, text: string) => {
    onInsert(text);
    setInserted(i);
  };

  const busy = status === "loading";

  return (
    <div className={cn(dark && "dark")}>
      <div className="my-2 overflow-hidden rounded-2xl border bg-background font-sans text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(10,102,194,0.25)]">
        {/* Gradient hairline */}
        <div className="h-0.5 bg-gradient-to-r from-brand-from to-brand-to" />

        {/* Header */}
        <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2">
          <BrandMark />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              AI comment suggestions
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {status === "done" && result
                ? `${result.analysis.post_type} · ${result.analysis.sentiment}`
                : "Pick a tone, then click a suggestion to insert it"}
            </div>
          </div>
          {status === "done" && (
            <button
              type="button"
              onClick={() => regenerate()}
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Regenerate"
              aria-label="Regenerate suggestions"
            >
              <RefreshCw className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={collapsed ? "Expand" : "Collapse"}
            aria-label={collapsed ? "Expand panel" : "Collapse panel"}
            aria-expanded={!collapsed}
          >
            <ChevronDown className={cn("size-4 transition-transform", collapsed && "-rotate-90")} />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Close"
            aria-label="Close suggestions"
          >
            <X className="size-4" />
          </button>
        </div>

        {!collapsed && (
          <div className="space-y-3 px-3.5 pb-3.5">
            {/* Controls */}
            <PillGroup ariaLabel="Tone" options={TONES} value={tone} onChange={changeTone} disabled={busy} scroll size="sm" />
            <div className="flex items-center justify-between gap-2">
              <PillGroup ariaLabel="Length" options={LENGTHS} value={length} onChange={changeLength} disabled={busy} size="sm" />
              {status === "done" && result && (
                <span className="truncate text-xs text-muted-foreground" title={result.model}>
                  {result.comments.length} options
                </span>
              )}
            </div>

            {/* Body */}
            {status === "idle" && settings && (
              <button
                type="button"
                onClick={() => regenerate({}, false)}
                className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-from to-brand-to text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                <Sparkles className="size-4" />
                Suggest comments for this post
              </button>
            )}

            {busy && <LoadingCards count={settings?.count ?? 3} step={step} />}

            {status === "error" && (
              <div className="flex gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm break-words text-foreground">{error}</p>
                  <button
                    type="button"
                    onClick={() => regenerate()}
                    className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium hover:bg-muted"
                  >
                    <RefreshCw className="size-3.5" /> Try again
                  </button>
                </div>
              </div>
            )}

            {status === "done" && result && (
              <div className="space-y-2">
                <p className="rounded-lg bg-muted/70 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">About this post: </span>
                  {result.analysis.summary}
                </p>
                {result.comments.map((c, i) => (
                  <CommentCard key={`${i}-${c.text.slice(0, 16)}`} option={c} index={i} selected={inserted === i} onUse={(t) => use(i, t)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
