// PRISM — AI provider abstraction + OpenAI-compatible implementation (Phase 4).
// Free-tier providers only. Credentials come exclusively from Edge Function
// secrets. No automatic paid fallback is ever permitted. The event analysis
// logic depends only on the AiProvider interface, so providers are swappable.

export interface AiProviderConfig {
  provider: string;        // e.g. "groq", "gemini", "openrouter" (free models)
  apiBaseUrl: string;      // OpenAI-compatible endpoint
  model: string;
  apiKey: string;          // from Deno.env / supabase secrets — never frontend
  timeoutMs: number;
  maxTokens: number;
}

export interface AiAnalysisRequest {
  systemPrompt: string;
  userPrompt: string;
  promptVersion: string;
  expectJson: true;
}

export type AiErrorKind =
  | "rate_limited"
  | "quota_exhausted"
  | "auth"
  | "timeout"
  | "invalid_response"
  | "unavailable"
  | "unknown";

export type AiProviderResult =
  | { ok: true; provider: string; model: string; json: unknown }
  | { ok: false; kind: AiErrorKind; message: string; retryAfterSeconds?: number };

export interface AiProvider {
  readonly name: string;
  analyze(request: AiAnalysisRequest): Promise<AiProviderResult>;
}

/** Reads provider configuration from Edge Function secrets. */
export function readProviderConfig(): AiProviderConfig | null {
  const provider = Deno.env.get("AI_PROVIDER");
  const apiBaseUrl = Deno.env.get("AI_API_BASE_URL");
  const model = Deno.env.get("AI_MODEL");
  const apiKey = Deno.env.get("AI_API_KEY");
  if (!provider || !apiBaseUrl || !model || !apiKey) return null;
  return {
    provider,
    apiBaseUrl,
    model,
    apiKey,
    timeoutMs: Number(Deno.env.get("AI_TIMEOUT_MS") ?? 30000),
    maxTokens: Number(Deno.env.get("AI_MAX_TOKENS") ?? 2048),
  };
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

function extractJson(content: string): unknown | null {
  try {
    return JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { return null; }
    }
    return null;
  }
}

/**
 * OpenAI-compatible chat-completions provider. fetchImpl is injectable for
 * unit tests. Requests JSON mode; if the endpoint rejects response_format
 * (some free models), retries once without it and extracts JSON from text.
 */
export function createOpenAiCompatibleProvider(config: AiProviderConfig, fetchImpl: FetchLike = fetch): AiProvider {
  const endpoint = config.apiBaseUrl.replace(/\/+$/, "") + "/chat/completions";

  return {
    name: config.provider,
    async analyze(request: AiAnalysisRequest): Promise<AiProviderResult> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs);
      const doFetch = (useJsonMode: boolean) => {
        const body: Record<string, unknown> = {
          model: config.model,
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt },
          ],
          temperature: 0.2,
          max_tokens: config.maxTokens,
        };
        if (useJsonMode) body.response_format = { type: "json_object" };
        return fetchImpl(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + config.apiKey },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      };
      try {
        let res = await doFetch(true);
        if (res.status === 400) {
          const text = await res.text();
          if (/response_format|json_object|json mode/i.test(text)) {
            res = await doFetch(false);
          } else {
            return { ok: false, kind: "unknown", message: "HTTP 400: " + text.slice(0, 200) };
          }
        }
        if (res.status === 429) {
          const ra = Number(res.headers.get("retry-after"));
          return { ok: false, kind: "rate_limited", message: "HTTP 429 rate limit", retryAfterSeconds: Number.isFinite(ra) && ra > 0 ? ra : undefined };
        }
        if (res.status === 401 || res.status === 403) return { ok: false, kind: "auth", message: "HTTP " + res.status + " — check AI_API_KEY" };
        if (res.status === 402) return { ok: false, kind: "quota_exhausted", message: "HTTP 402 — free allowance exhausted" };
        if (res.status >= 500) return { ok: false, kind: "unavailable", message: "HTTP " + res.status };
        if (!res.ok) { const t = await res.text().catch(() => ""); return { ok: false, kind: "unknown", message: "HTTP " + res.status + ": " + t.slice(0, 200) }; }
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== "string" || content.trim() === "") {
          return { ok: false, kind: "invalid_response", message: "empty completion content" };
        }
        const json = extractJson(content);
        if (json === null) return { ok: false, kind: "invalid_response", message: "completion is not valid JSON" };
        return { ok: true, provider: config.provider, model: config.model, json };
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return { ok: false, kind: "timeout", message: "request timed out after " + config.timeoutMs + "ms" };
        }
        return { ok: false, kind: "unavailable", message: err instanceof Error ? err.message : String(err) };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
