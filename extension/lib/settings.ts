import { storage } from "#imports";
import type { Length, Tone } from "./types";

export interface Settings {
  enabled: boolean;
  autoGenerate: boolean;
  backendUrl: string;
  tone: Tone;
  length: Length;
  count: number;
  useEmojis: boolean;
  persona: string;
  instructions: string;
  model: string;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  autoGenerate: true,
  backendUrl: "http://127.0.0.1:8000",
  tone: "professional",
  length: "medium",
  count: 4,
  useEmojis: false,
  persona: "",
  instructions: "",
  model: "",
};

export const settingsItem = storage.defineItem<Settings>("sync:settings", {
  fallback: DEFAULT_SETTINGS,
});

export async function getSettings(): Promise<Settings> {
  // Merge so newly added settings get defaults for existing users.
  return { ...DEFAULT_SETTINGS, ...(await settingsItem.getValue()) };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await settingsItem.setValue(next);
  return next;
}

export function normaliseBackendUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}
