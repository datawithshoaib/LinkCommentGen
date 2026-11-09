import type { Settings } from "./settings";
import type {
  BgRequest,
  BgResponse,
  GenerateOptions,
  GenerateRequest,
  GenerateResponse,
  HealthResponse,
  PostContext,
} from "./types";

async function send<T>(msg: BgRequest): Promise<T> {
  let res: BgResponse<T> | undefined;
  try {
    res = await browser.runtime.sendMessage(msg);
  } catch {
    throw new Error("The extension was updated. Refresh this page to keep using it.");
  }
  if (!res) throw new Error("No response from the extension background worker.");
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export function optionsFromSettings(s: Settings): GenerateOptions {
  return {
    tone: s.tone,
    length: s.length,
    count: s.count,
    use_emojis: s.useEmojis,
    persona: s.persona || undefined,
    instructions: s.instructions || undefined,
    model: s.model || undefined,
  };
}

export function generateComments(post: PostContext, options: GenerateOptions): Promise<GenerateResponse> {
  const payload: GenerateRequest = { ...post, ...options };
  return send<GenerateResponse>({ type: "generate", payload });
}

export function checkHealth(): Promise<HealthResponse> {
  return send<HealthResponse>({ type: "health" });
}
