// PRISM — extract-company-profile Edge Function (V2 Phase 2).
// Authenticated caller + EXPLICIT consent -> Groq extraction of the user's
// own company description into structured SUGGESTIONS. Nothing is saved
// here; the user confirms/edits in the UI before anything is persisted.
// Privacy: the description is never logged; errors are generic.

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/database.ts";
import { readProviderConfig, createOpenAiCompatibleProvider } from "../_shared/ai-provider.ts";
import { EXTRACTION_PROMPT, EXTRACTION_PROMPT_VERSION } from "../_shared/prompts.ts";
import { isRecord, isNonEmptyString } from "../_shared/validation.ts";

const MAX_DESCRIPTION = 4000;
const ISO_RE = /^[A-Z]{2}$/;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KINDS = ["route", "chokepoint", "infrastructure", "other"];

function strArray(v: unknown, max = 40): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => (x as string).trim()).slice(0, max) : [];
}
function isoArray(v: unknown): string[] {
  return [...new Set(strArray(v).map((x) => x.toUpperCase()).filter((x) => ISO_RE.test(x)))];
}

function validateSuggestions(json: unknown): { ok: true; value: Record<string, unknown> } | { ok: false } {
  if (!isRecord(json)) return { ok: false };
  const o = json as Record<string, unknown>;
  const commodities = strArray(o.commodities).map((c) => c.toLowerCase().replace(/\s+/g, "-")).filter((c) => SLUG_RE.test(c));
  const products = Array.isArray(o.products)
    ? (o.products as unknown[]).filter(isRecord).map((p) => ({ name: String(p.name ?? "").trim().slice(0, 120), category: isNonEmptyString(p.category) ? String(p.category).slice(0, 80) : null })).filter((p) => p.name).slice(0, 40)
    : [];
  const dependencies = Array.isArray(o.dependencies)
    ? (o.dependencies as unknown[]).filter(isRecord).map((d) => ({ kind: KINDS.includes(d.kind as string) ? d.kind : "other", ref: String(d.ref ?? "").trim().slice(0, 120) })).filter((d) => d.ref).slice(0, 20)
    : [];
  return {
    ok: true,
    value: {
      name: isNonEmptyString(o.name) ? String(o.name).slice(0, 120) : null,
      industry: isNonEmptyString(o.industry) ? String(o.industry).slice(0, 80) : null,
      business_type: isNonEmptyString(o.business_type) ? String(o.business_type).slice(0, 80) : null,
      operating_countries: isoArray(o.operating_countries),
      supplier_countries: isoArray(o.supplier_countries),
      customer_countries: isoArray(o.customer_countries),
      transport_countries: isoArray(o.transport_countries),
      commodities: [...new Set(commodities)],
      industries: strArray(o.industries).map((x) => x.toLowerCase()).slice(0, 20),
      products,
      dependencies,
      uncertainties: strArray(o.uncertainties, 10),
    },
  };
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return jsonResponse({ error: "missing_token" }, 401);
    const db = createServiceClient();
    const { data: userData, error: userErr } = await db.auth.getUser(jwt);
    if (userErr || !userData?.user) return jsonResponse({ error: "invalid_token" }, 401);

    const body = await req.json().catch(() => ({}));
    if (body?.consent !== true) {
      return jsonResponse({ error: "consent_required", message: "Explicit consent is required to send your description to the AI provider." }, 400);
    }
    const description = String(body?.description ?? "").trim();
    if (description.length < 20) return jsonResponse({ error: "description_too_short" }, 400);
    if (description.length > MAX_DESCRIPTION) return jsonResponse({ error: "description_too_long", max: MAX_DESCRIPTION }, 400);

    const config = readProviderConfig();
    if (!config) return jsonResponse({ error: "ai_provider_not_configured" }, 503);
    const provider = createOpenAiCompatibleProvider(config);
    const result = await provider.analyze({
      systemPrompt: EXTRACTION_PROMPT,
      userPrompt: "Company description (user's own words):\n" + description,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      expectJson: true,
    });
    if (!result.ok) {
      // Generic error only — never echo the description or provider details.
      return jsonResponse({ error: "extraction_failed", kind: result.kind }, 502);
    }
    const validated = validateSuggestions(result.json);
    if (!validated.ok) return jsonResponse({ error: "invalid_extraction" }, 502);

    return jsonResponse({
      status: "ok",
      suggestions: validated.value,
      prompt_version: EXTRACTION_PROMPT_VERSION,
      provider: config.provider,
      note: "Suggestions only. Nothing is saved until you confirm in the interface.",
    });
  } catch (err) {
    console.error("[PRISM] extract-company-profile failed:", err instanceof Error ? err.name : "error");
    return jsonResponse({ error: "extraction_error" }, 500);
  }
});
