import { getSettings, normaliseBackendUrl } from "@/lib/settings";
import type { BgRequest, BgResponse, GenerateResponse, HealthResponse } from "@/lib/types";

const GENERATE_TIMEOUT_MS = 90_000;
const HEALTH_TIMEOUT_MS = 5_000;

async function callBackend<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const { backendUrl } = await getSettings();
  const base = normaliseBackendUrl(backendUrl);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error("The backend took too long to respond. Please try again.");
    }
    throw new Error(`Can't reach the backend at ${base}. Is it running? (cd backend && uv run python -m app.main)`);
  }

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail) && body.detail[0]?.msg) detail = body.detail[0].msg.replace(/^Value error, /, "");
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

async function handle(msg: BgRequest): Promise<unknown> {
  switch (msg.type) {
    case "generate":
      return callBackend<GenerateResponse>(
        "/api/generate",
        { method: "POST", body: JSON.stringify(msg.payload) },
        GENERATE_TIMEOUT_MS,
      );
    case "health":
      return callBackend<HealthResponse>("/health", { method: "GET" }, HEALTH_TIMEOUT_MS);
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((msg: BgRequest, _sender, sendResponse) => {
    handle(msg)
      .then((data) => sendResponse({ ok: true, data } satisfies BgResponse<unknown>))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) } satisfies BgResponse<unknown>),
      );
    return true; // keep the channel open for the async response
  });
});
