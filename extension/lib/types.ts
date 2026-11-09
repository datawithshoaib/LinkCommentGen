export const TONES = [
  { value: "professional", label: "Professional", emoji: "💼" },
  { value: "friendly", label: "Friendly", emoji: "😊" },
  { value: "supportive", label: "Supportive", emoji: "🤝" },
  { value: "insightful", label: "Insightful", emoji: "💡" },
  { value: "curious", label: "Curious", emoji: "🤔" },
  { value: "witty", label: "Witty", emoji: "😄" },
  { value: "celebratory", label: "Celebratory", emoji: "🎉" },
] as const;

export const LENGTHS = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
] as const;

export const MODELS = [
  { value: "", label: "Server default" },
  { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
  { value: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
  { value: "moonshotai/kimi-k2-instruct-0905", label: "Kimi K2" },
  { value: "meta-llama/llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick" },
] as const;

export type Tone = (typeof TONES)[number]["value"];
export type Length = (typeof LENGTHS)[number]["value"];

export interface PostContext {
  post_text: string;
  author_name?: string;
  author_headline?: string;
  media_description?: string;
}

export interface GenerateOptions {
  tone: Tone;
  length: Length;
  count: number;
  use_emojis: boolean;
  persona?: string;
  instructions?: string;
  model?: string;
}

export type GenerateRequest = PostContext & GenerateOptions;

export interface CommentOption {
  angle: string;
  text: string;
}

export interface GenerateResponse {
  analysis: {
    summary: string;
    post_type: string;
    sentiment: string;
    key_points: string[];
  };
  comments: CommentOption[];
  model: string;
}

export interface HealthResponse {
  status: string;
  model: string;
  groq_configured: boolean;
}

/** Messages exchanged between content script / popup and the background worker. */
export type BgRequest =
  | { type: "generate"; payload: GenerateRequest }
  | { type: "health" };

export type BgResponse<T> = { ok: true; data: T } | { ok: false; error: string };
