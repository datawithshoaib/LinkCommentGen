import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, MousePointerClick, PenLine, Settings2, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { CommentCard } from "@/components/comment-card";
import { LoadingCards, useLoadingStep } from "@/components/loading-cards";
import { PillGroup } from "@/components/pill-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { checkHealth, generateComments, optionsFromSettings } from "@/lib/api";
import { DEFAULT_SETTINGS, getSettings, normaliseBackendUrl, updateSettings, type Settings } from "@/lib/settings";
import { LENGTHS, MODELS, TONES, type GenerateResponse, type HealthResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

type Health = { state: "checking" } | { state: "ok"; info: HealthResponse } | { state: "down"; error: string };

const DEFAULT_MODEL = "__default__";
const COUNTS = [
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
  { value: "6", label: "6" },
] as const;

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [health, setHealth] = useState<Health>({ state: "checking" });

  const refreshHealth = useCallback(async () => {
    setHealth({ state: "checking" });
    try {
      setHealth({ state: "ok", info: await checkHealth() });
    } catch (e) {
      setHealth({ state: "down", error: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setLoaded(true);
    });
    void refreshHealth();
  }, [refreshHealth]);

  const save = useCallback(async (patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    await updateSettings(patch);
  }, []);

  if (!loaded) return <div className="h-[520px] w-[400px] bg-background" />;

  return (
    <div className="flex max-h-[600px] min-h-[520px] w-[400px] flex-col bg-background font-sans text-foreground antialiased">
      {/* Header */}
      <header className="relative flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-from to-brand-to" />
        <BrandMark className="size-9 rounded-xl" />
        <div className="min-w-0 flex-1">
          <h1 className="text-base leading-tight font-semibold">LinkComment AI</h1>
          <StatusLine health={health} />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="enabled" className="text-xs text-muted-foreground">
            {settings.enabled ? "On" : "Off"}
          </Label>
          <Switch id="enabled" checked={settings.enabled} onCheckedChange={(v) => save({ enabled: v })} />
        </div>
      </header>

      <Tabs defaultValue="compose" className="min-h-0 flex-1 gap-0">
        <div className="px-4">
          <TabsList className="w-full">
            <TabsTrigger value="compose" className="cursor-pointer">
              <PenLine /> Compose
            </TabsTrigger>
            <TabsTrigger value="settings" className="cursor-pointer">
              <Settings2 /> Settings
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="compose" className="min-h-0 overflow-y-auto px-4 pt-3 pb-4">
          <ComposeTab settings={settings} save={save} />
        </TabsContent>
        <TabsContent value="settings" className="min-h-0 overflow-y-auto px-4 pt-3 pb-4">
          <SettingsTab settings={settings} save={save} onBackendChanged={refreshHealth} health={health} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusLine({ health }: { health: Health }) {
  const [dot, label] =
    health.state === "checking"
      ? ["bg-muted-foreground/50 animate-pulse", "Connecting to backend…"]
      : health.state === "down"
        ? ["bg-red-500", "Backend offline"]
        : health.info.groq_configured
          ? ["bg-green-500", `Connected · ${health.info.model}`]
          : ["bg-amber-500", "Backend up · GROQ_API_KEY missing"];
  return (
    <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
      <span className={cn("size-1.5 shrink-0 rounded-full", dot)} />
      <span className="truncate">{label}</span>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Compose
// ---------------------------------------------------------------------------
function ComposeTab({ settings, save }: { settings: Settings; save: (p: Partial<Settings>) => void }) {
  const [post, setPost] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const step = useLoadingStep(busy);

  const generate = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await generateComments({ post_text: post }, optionsFromSettings(settings)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-xl border border-primary/20 bg-accent/60 p-3">
        <MousePointerClick className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-accent-foreground">
          On LinkedIn, click <b>Comment</b> on any post and suggestions appear right under the comment box. Or paste a post
          below.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="post">Post text</Label>
        <Textarea
          id="post"
          value={post}
          onChange={(e) => setPost(e.target.value)}
          placeholder="Paste a LinkedIn post…"
          className="max-h-40 min-h-24 resize-y text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Tone</Label>
        <PillGroup ariaLabel="Tone" options={TONES} value={settings.tone} onChange={(tone) => save({ tone })} size="sm" />
      </div>

      <div className="space-y-1.5">
        <Label>Length</Label>
        <PillGroup ariaLabel="Length" options={LENGTHS} value={settings.length} onChange={(length) => save({ length })} size="sm" />
      </div>

      <Button
        onClick={generate}
        disabled={busy || post.trim().length < 10}
        className="h-10 w-full cursor-pointer bg-gradient-to-r from-brand-from to-brand-to font-semibold text-white hover:opacity-90"
      >
        {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {busy ? "Generating…" : "Generate comments"}
      </Button>

      {busy && <LoadingCards count={settings.count} step={step} />}

      {error && (
        <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{result.analysis.post_type}</span> · {result.analysis.summary}
          </p>
          {result.comments.map((c, i) => (
            <CommentCard key={i} option={c} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
function SettingsTab({
  settings,
  save,
  onBackendChanged,
  health,
}: {
  settings: Settings;
  save: (p: Partial<Settings>) => Promise<void>;
  onBackendChanged: () => void;
  health: Health;
}) {
  const [url, setUrl] = useState(settings.backendUrl);
  const [urlError, setUrlError] = useState("");
  const [persona, setPersona] = useState(settings.persona);
  const [instructions, setInstructions] = useState(settings.instructions);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flashSaved = () => {
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1400);
  };

  const saveAndFlash = async (patch: Partial<Settings>) => {
    await save(patch);
    flashSaved();
  };

  const saveUrl = async () => {
    const next = normaliseBackendUrl(url);
    let parsed: URL;
    try {
      parsed = new URL(next);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error();
    } catch {
      setUrlError("Enter a full URL, e.g. http://127.0.0.1:8000");
      return;
    }
    setUrlError("");
    const isLocal = ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (!isLocal) {
      const granted = await browser.permissions.request({ origins: [`${parsed.origin}/*`] });
      if (!granted) {
        setUrlError("Permission to reach this server was denied.");
        return;
      }
    }
    setUrl(next);
    await saveAndFlash({ backendUrl: next });
    onBackendChanged();
  };

  return (
    <div className="space-y-5">
      <Section title="Backend">
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveUrl()}
            placeholder="http://127.0.0.1:8000"
            className="h-9 font-mono text-xs"
            aria-invalid={!!urlError}
          />
          <Button variant="outline" onClick={saveUrl} className="h-9 cursor-pointer">
            {health.state === "checking" ? <Loader2 className="animate-spin" /> : "Save & test"}
          </Button>
        </div>
        {urlError && <p className="text-xs text-destructive">{urlError}</p>}
        {health.state === "down" && !urlError && <p className="text-xs break-words text-destructive">{health.error}</p>}
        {health.state === "ok" && !health.info.groq_configured && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Backend is running but has no GROQ_API_KEY. Add it to backend/.env and restart it.
          </p>
        )}

        <Field label="Model" hint="Groq model used to write comments">
          <Select
            value={settings.model || DEFAULT_MODEL}
            onValueChange={(v) => saveAndFlash({ model: v === DEFAULT_MODEL ? "" : v })}
          >
            <SelectTrigger size="sm" className="w-44 cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              {MODELS.map((m) => (
                <SelectItem key={m.value || DEFAULT_MODEL} value={m.value || DEFAULT_MODEL} className="cursor-pointer">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Section>

      <Section title="Suggestions">
        <Field label="Auto-suggest" hint="Generate as soon as you open a comment box">
          <Switch checked={settings.autoGenerate} onCheckedChange={(v) => saveAndFlash({ autoGenerate: v })} />
        </Field>
        <Field label="Emojis" hint="Allow an occasional emoji">
          <Switch checked={settings.useEmojis} onCheckedChange={(v) => saveAndFlash({ useEmojis: v })} />
        </Field>
        <Field label="Options" hint="How many comments to suggest">
          <PillGroup
            ariaLabel="Number of options"
            options={COUNTS}
            value={String(settings.count) as (typeof COUNTS)[number]["value"]}
            onChange={(v) => saveAndFlash({ count: Number(v) })}
            size="sm"
          />
        </Field>
        <div className="space-y-1.5">
          <Label className="text-sm">Default tone</Label>
          <PillGroup ariaLabel="Default tone" options={TONES} value={settings.tone} onChange={(tone) => saveAndFlash({ tone })} size="sm" />
        </div>
      </Section>

      <Section title="Personalise">
        <div className="space-y-1.5">
          <Label htmlFor="persona">About you</Label>
          <Textarea
            id="persona"
            value={persona}
            maxLength={600}
            onChange={(e) => setPersona(e.target.value)}
            onBlur={() => persona !== settings.persona && saveAndFlash({ persona: persona.trim() })}
            placeholder="e.g. Data engineer at a fintech, 6 years in analytics, into open-source."
            className="min-h-16 text-sm"
          />
          <p className="text-xs text-muted-foreground">Helps comments sound like you and stay credible.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="instructions">Style instructions</Label>
          <Textarea
            id="instructions"
            value={instructions}
            maxLength={600}
            onChange={(e) => setInstructions(e.target.value)}
            onBlur={() => instructions !== settings.instructions && saveAndFlash({ instructions: instructions.trim() })}
            placeholder="e.g. Use British spelling. Never mention my company."
            className="min-h-16 text-sm"
          />
        </div>
      </Section>

      <div
        className={cn(
          "pointer-events-none fixed right-4 bottom-4 flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-lg transition-all",
          saved ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        <Check className="size-3.5" /> Saved
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</h2>
      <div className="space-y-3.5 rounded-xl border bg-card p-3.5">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </div>
  );
}
