// PRISM — calculate-risk Edge Function (Phase 5).
// Drains calculate_risk jobs: loads the latest validated analysis for each
// event, derives dimensions with documented deterministic rules, computes
// the overall score with explicit weighted arithmetic, and stores an
// APPEND-ONLY history row (dimension scores, overall, explanation,
// confidence). The AI never produces the final score.

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/database.ts";
import { deriveDimensions, computeOverallScore, buildExplanation } from "../_shared/risk.ts";
import type { AiAnalysisOutput } from "../_shared/types.ts";

const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 3;

interface JobRow { id: string; entity_id: string | null; attempts: number; }

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET" && req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const db = createServiceClient();
    const { data: jobs, error } = await db.from("processing_jobs")
      .select("id, entity_id, attempts")
      .eq("job_type", "calculate_risk").eq("status", "pending")
      .order("created_at", { ascending: true }).limit(BATCH_SIZE);
    if (error) throw new Error("job query failed: " + error.message);

    const results = { scored: 0, retried: 0, failed: 0, skipped: 0 };
    const scores: Array<{ event_id: string; overall: number }> = [];

    for (const job of (jobs ?? []) as JobRow[]) {
      const { data: claimed } = await db.from("processing_jobs")
        .update({ status: "running", attempts: job.attempts + 1 })
        .eq("id", job.id).eq("status", "pending").select("id");
      if (!claimed || claimed.length === 0) { results.skipped++; continue; }

      try {
        if (!job.entity_id) throw new Error("job has no entity_id");
        const { data: analyses, error: anErr } = await db.from("analyses")
          .select("analysis_json, confidence")
          .eq("event_id", job.entity_id)
          .order("created_at", { ascending: false }).limit(1);
        if (anErr) throw new Error("analysis load failed: " + anErr.message);
        if (!analyses || analyses.length === 0) throw new Error("no analysis for event");

        const analysis = analyses[0].analysis_json as AiAnalysisOutput;
        const dimensions = deriveDimensions(analysis);
        const overall = computeOverallScore(dimensions);
        if (overall === null) throw new Error("dimension derivation produced invalid scores");
        const explanation = buildExplanation(dimensions, overall, analysis);
        const confidence = analyses[0].confidence ?? analysis.confidence_level ?? null;

        const { error: insErr } = await db.from("risk_scores").insert({
          event_id: job.entity_id,
          severity_score: dimensions.severity,
          probability_score: dimensions.probability,
          geographic_score: dimensions.geographic,
          duration_score: dimensions.duration,
          supply_chain_score: dimensions.supply_chain,
          economic_score: dimensions.economic,
          overall_score: overall,
          explanation,
          confidence,
        });
        if (insErr) throw new Error("score store failed: " + insErr.message);

        await db.from("processing_jobs").update({ status: "completed", completed_at: new Date().toISOString(), last_error: null }).eq("id", job.id);
        results.scored++;
        scores.push({ event_id: job.entity_id, overall });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const exhausted = job.attempts + 1 >= MAX_ATTEMPTS;
        await db.from("processing_jobs").update({ status: exhausted ? "failed" : "pending", last_error: message }).eq("id", job.id);
        if (exhausted) results.failed++;
        else results.retried++;
      }
    }

    return jsonResponse({
      status: "ok",
      function: "calculate-risk",
      timestamp: new Date().toISOString(),
      ...results,
      scores,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[PRISM] calculate-risk failed:", message);
    return jsonResponse({ status: "error", function: "calculate-risk", error: message }, 500);
  }
});
