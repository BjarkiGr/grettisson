// PRISM — analyze-events Edge Function (Phase 4).
// Drains analyze_event jobs in small batches through the configured
// free-tier AI provider. Validates structured output strictly (fabricated
// citations rejected), stores analyses with full provenance, refines
// events, and queues calculate_risk jobs for Phase 5.
// Quota/rate-limit -> pause with recorded reason + auto-resume windows.
// The rest of PRISM keeps working when AI is unavailable.

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { isServiceRole, readJsonLimited } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/database.ts";
import type { SupabaseClient } from "../_shared/database.ts";
import { readProviderConfig, createOpenAiCompatibleProvider } from "../_shared/ai-provider.ts";
import { PROMPT_VERSION_V21, SYSTEM_PROMPT_V21, buildUserPromptV21 } from "../_shared/prompts.ts";
import type { PromptArticleV21 as PromptArticle } from "../_shared/prompts.ts";
import { validateAnalysisOutputV21 } from "../_shared/analysis-validation.ts";
import { contentHash } from "../_shared/normalize.ts";

const BATCH_SIZE = 3;
const MAX_ATTEMPTS = 3;
const MAX_ARTICLES_PER_EVENT = 5;
const RATE_LIMIT_RESUME_MINUTES = 10;
const QUOTA_RESUME_MINUTES = 60;

interface JobRow { id: string; entity_id: string | null; attempts: number; }

async function loadEventArticles(db: SupabaseClient, eventId: string): Promise<PromptArticle[]> {
  const { data: links } = await db.from("event_articles").select("article_id").eq("event_id", eventId).limit(MAX_ARTICLES_PER_EVENT);
  const ids = (links ?? []).map((l) => l.article_id);
  if (ids.length === 0) return [];
  const { data: arts } = await db.from("articles").select("id, title, url, content, published_at, source_id").in("id", ids);
  const sourceIds = [...new Set((arts ?? []).map((a) => a.source_id))];
  const { data: sources } = await db.from("sources").select("id, name, source_type").in("id", sourceIds);
  const nameById = new Map((sources ?? []).map((s) => [s.id, s.name]));
  const typeById = new Map((sources ?? []).map((s) => [s.id, s.source_type]));
  return (arts ?? []).map((a) => ({
    id: a.id, title: a.title, url: a.url,
    excerpt: (a.content ?? "").slice(0, 1200),
    published_at: a.published_at,
    source_name: nameById.get(a.source_id) ?? "unknown source",
    source_type: typeById.get(a.source_id) ?? null,
  }));
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET" && req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!isServiceRole(req)) return jsonResponse({ error: "unauthorized" }, 401);

  const config = readProviderConfig();
  if (!config) {
    return jsonResponse({
      status: "paused", function: "analyze-events",
      reason: "ai_provider_not_configured",
      message: "Set AI_PROVIDER, AI_API_BASE_URL, AI_MODEL, AI_API_KEY via supabase secrets set.",
    }, 503);
  }

  try {
    const db = createServiceClient();
    const provider = createOpenAiCompatibleProvider(config);
    const body = req.method === "POST" ? ((await readJsonLimited(req, 2048)) ?? {}) : {};

    // Auto-resume paused jobs once their backoff window has elapsed.
    const rateCutoff = new Date(Date.now() - RATE_LIMIT_RESUME_MINUTES * 60000).toISOString();
    const quotaCutoff = new Date(Date.now() - QUOTA_RESUME_MINUTES * 60000).toISOString();
    await db.from("processing_jobs").update({ status: "pending" })
      .eq("job_type", "analyze_event").eq("status", "paused")
      .like("last_error", "rate_limited%").lt("updated_at", rateCutoff);
    await db.from("processing_jobs").update({ status: "pending" })
      .eq("job_type", "analyze_event").eq("status", "paused")
      .like("last_error", "quota_exhausted%").lt("updated_at", quotaCutoff);
    if (body && body.resume === true) {
      await db.from("processing_jobs").update({ status: "pending", attempts: 0 })
        .eq("job_type", "analyze_event").eq("status", "paused");
    }

    const { data: jobs, error } = await db.from("processing_jobs")
      .select("id, entity_id, attempts")
      .eq("job_type", "analyze_event").eq("status", "pending")
      .order("created_at", { ascending: true }).limit(BATCH_SIZE);
    if (error) throw new Error("job query failed: " + error.message);

    const results = { analyzed: 0, rejected: 0, retried: 0, failed: 0, paused: 0, skipped: 0, skipped_unchanged: 0 };
    let pausedReason: string | null = null;

    for (const job of (jobs ?? []) as JobRow[]) {
      const { data: claimed } = await db.from("processing_jobs")
        .update({ status: "running", attempts: job.attempts + 1 })
        .eq("id", job.id).eq("status", "pending").select("id");
      if (!claimed || claimed.length === 0) { results.skipped++; continue; }

      try {
        if (!job.entity_id) throw new Error("job has no entity_id");
        const { data: event, error: evErr } = await db.from("events")
          .select("id, title, summary, category, primary_country, region").eq("id", job.entity_id).single();
        if (evErr || !event) throw new Error("event load failed: " + (evErr?.message ?? "not found"));
        const articles = await loadEventArticles(db, event.id);
        if (articles.length === 0) throw new Error("event has no supporting articles");

        // Quota-safe change detection (V2 section 10): skip unchanged inputs.
        const inputsHash = await contentHash(event.id, articles.map((a) => a.id).sort().join(","));
        const { data: lastAn } = await db.from("analyses").select("inputs_hash, created_at").eq("event_id", event.id).order("created_at", { ascending: false }).limit(1);
        const last = lastAn?.[0];
        if (last?.inputs_hash === inputsHash && Date.now() - new Date(last.created_at).getTime() < 7 * 86400000) {
          await db.from("processing_jobs").update({ status: "completed", completed_at: new Date().toISOString(), last_error: null }).eq("id", job.id);
          results.skipped_unchanged++;
          continue;
        }

        const result = await provider.analyze({
          systemPrompt: SYSTEM_PROMPT_V21,
          userPrompt: buildUserPromptV21(event, articles),
          promptVersion: PROMPT_VERSION_V21,
          expectJson: true,
        });

        if (!result.ok) {
          if (result.kind === "rate_limited" || result.kind === "quota_exhausted" || result.kind === "auth") {
            await db.from("processing_jobs").update({ status: "paused", last_error: result.kind + ": " + result.message }).eq("id", job.id);
            results.paused++;
            pausedReason = result.kind;
            break; // stop the batch; free allowance must recover first
          }
          throw new Error(result.kind + ": " + result.message);
        }

        const validation = validateAnalysisOutputV21(result.json, articles.map((a) => a.id), articles.map((a) => a.url));
        if (!validation.ok) {
          results.rejected++;
          throw new Error("invalid_response: " + validation.errors.slice(0, 3).join("; "));
        }
        const a = validation.value;

        const { error: insErr } = await db.from("analyses").insert({
          event_id: event.id,
          article_id: articles[0].id,
          provider: result.provider,
          model: result.model,
          prompt_version: PROMPT_VERSION_V21,
          inputs_hash: inputsHash,
          analysis_json: a,
          confidence: a.confidence_level,
        });
        if (insErr) throw new Error("analysis store failed: " + insErr.message);

        await db.from("events").update({
          title: a.event_title,
          summary: a.executive_summary,
          category: a.event_category,
          severity: a.severity_assessment,
          region: event.region ?? a.geographic_region,
          primary_country: event.primary_country ?? (a.countries_involved[0] ?? null),
          last_updated_at: new Date().toISOString(),
        }).eq("id", event.id);

        const { error: riskErr } = await db.from("processing_jobs").insert({ job_type: "calculate_risk", entity_id: event.id });
        if (riskErr && riskErr.code !== "23505") throw new Error("risk queue failed: " + riskErr.message);

        await db.from("processing_jobs").update({ status: "completed", completed_at: new Date().toISOString(), last_error: null }).eq("id", job.id);
        results.analyzed++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const exhausted = job.attempts + 1 >= MAX_ATTEMPTS;
        await db.from("processing_jobs").update({ status: exhausted ? "failed" : "pending", last_error: message }).eq("id", job.id);
        if (exhausted) results.failed++;
        else results.retried++;
      }
    }

    return jsonResponse({
      status: pausedReason ? "paused" : "ok",
      function: "analyze-events",
      provider: config.provider,
      model: config.model,
      prompt_version: PROMPT_VERSION_V21,
      timestamp: new Date().toISOString(),
      paused_reason: pausedReason,
      ...results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[PRISM] analyze-events failed:", message);
    return jsonResponse({ status: "error", function: "analyze-events", error: message }, 500);
  }
});
