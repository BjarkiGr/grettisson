// PRISM — calculate-risk Edge Function (V2).
// V2 analyses (prompt 2.0.0) -> risk-v2 matrix methodology with full inputs
// snapshot (scoring_version 2.0.0). Legacy analyses -> V1 derivation, stored
// as scoring_version 1.0.0 history. Append-only. AI never writes final scores.

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/database.ts";
import { deriveDimensions, computeOverallScore, buildExplanation } from "../_shared/risk.ts";
import { assessRiskV2, SCORING_VERSION, MAJOR_ECONOMIES, CHOKEPOINT_STATES, V2_DIMENSIONS } from "../_shared/risk-v2.ts";
import type { RiskV2Inputs } from "../_shared/risk-v2.ts";
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

    const results = { scored: 0, scored_v2: 0, scored_legacy: 0, unrated: 0, retried: 0, failed: 0, skipped: 0 };

    for (const job of (jobs ?? []) as JobRow[]) {
      const { data: claimed } = await db.from("processing_jobs")
        .update({ status: "running", attempts: job.attempts + 1 })
        .eq("id", job.id).eq("status", "pending").select("id");
      if (!claimed || claimed.length === 0) { results.skipped++; continue; }

      try {
        if (!job.entity_id) throw new Error("job has no entity_id");
        const { data: analyses, error: anErr } = await db.from("analyses")
          .select("id, analysis_json, confidence")
          .eq("event_id", job.entity_id)
          .order("created_at", { ascending: false }).limit(1);
        if (anErr) throw new Error("analysis load failed: " + anErr.message);
        if (!analyses || analyses.length === 0) throw new Error("no analysis for event");
        const an = analyses[0];
        const aj = an.analysis_json as AiAnalysisOutput & Record<string, any>;

        const { data: prev } = await db.from("risk_scores")
          .select("overall_score, scoring_version, likelihood_level")
          .eq("event_id", job.entity_id).order("created_at", { ascending: false }).limit(1);
        const previous = prev?.[0] ?? null;

        let insert: Record<string, unknown>;

        if (aj.dimensions && aj.likelihood) {
          // ---------- V2 path ----------
          const kinds = new Map<string, Set<string>>();
          for (const e of aj.supporting_evidence ?? []) {
            if (!kinds.has(e.article_id)) kinds.set(e.article_id, new Set());
            kinds.get(e.article_id)!.add(e.kind);
          }
          const dims = {} as RiskV2Inputs["dimensions"];
          for (const d of V2_DIMENSIONS) {
            const p = aj.dimensions[d] ?? { proposed_score: 0, evidence_article_ids: [] };
            dims[d] = {
              proposed: p.proposed_score,
              verified_evidence: (p.evidence_article_ids ?? []).some((id: string) => kinds.get(id)?.has("verified_fact")),
            };
          }
          const { data: links } = await db.from("event_articles").select("article_id").eq("event_id", job.entity_id);
          const ids = (links ?? []).map((l) => l.article_id);
          const { data: arts } = ids.length ? await db.from("articles").select("source_id").in("id", ids) : { data: [] as any[] };
          const independent = new Set((arts ?? []).map((a) => a.source_id)).size;
          const countries: string[] = aj.countries_involved ?? [];
          const inputs: RiskV2Inputs = {
            dimensions: dims,
            major_economy_affected: countries.some((c) => MAJOR_ECONOMIES.includes(c) || CHOKEPOINT_STATES.includes(c)),
            independent_sources: independent,
            material_contradictions: (aj.confidence_inputs?.material_contradictions ?? []).length > 0,
            verified_fact_count: (aj.supporting_evidence ?? []).filter((e) => e.kind === "verified_fact").length,
            ai_likelihood: { level: aj.likelihood.level, horizon_days: aj.likelihood.horizon_days, outcome: aj.likelihood.outcome },
            ongoing_confirmed: aj.likelihood.ongoing_claim === true,
          };
          const r = assessRiskV2(inputs);
          const delta = previous && previous.scoring_version === SCORING_VERSION && r.risk_index !== null
            ? " Change vs previous assessment: " + (r.risk_index - previous.overall_score > 0 ? "+" : "") + (r.risk_index - previous.overall_score) + "."
            : "";
          const explanation = [
            "Heuristic risk index " + (r.risk_index === null ? "UNRATED (insufficient evidence)" : r.risk_index + "/100 (" + r.risk_band + ")") + "; impact index " + r.impact_index + "/100 (" + r.impact_band + ").",
            "Likelihood: " + r.likelihood + " (horizon " + r.horizon_days + "d" + (r.ongoing ? ", ongoing" : "") + "). Confidence: " + r.confidence + ".",
            ...V2_DIMENSIONS.map((d) => d + "=" + r.gated[d] + "/5: " + (aj.dimensions[d]?.rationale ?? "")),
            ...r.gate_notes, ...r.likelihood_notes,
            "Matrix cell: likelihood " + r.likelihood + " x impact " + r.impact_band + ". Scoring version " + SCORING_VERSION + "." + delta,
            "Change triggers: rises with verified escalation/disruption evidence; falls with verified resolution. Uncertainties: " + ((aj.uncertainties ?? []).join("; ") || "none recorded"),
          ].join(" ");
          insert = {
            event_id: job.entity_id, scoring_version: SCORING_VERSION, analysis_id: an.id,
            inputs: { inputs, gate_notes: r.gate_notes, likelihood_notes: r.likelihood_notes },
            likelihood_level: r.likelihood, likelihood_horizon_days: r.horizon_days,
            confidence_level: r.confidence, ongoing: r.ongoing, impact_index: r.impact_index,
            overall_score: r.risk_index ?? 0,
            escalation_score: r.gated.escalation, economic_impact_score: r.gated.economic,
            supply_chain_disruption_score: r.gated.supply_chain, geographic_reach_score: r.gated.geographic,
            strategic_importance_score: r.gated.strategic, persistence_score: r.gated.persistence,
            explanation,
          };
          results.scored_v2++;
          if (r.risk_index === null) results.unrated++;
        } else {
          // ---------- Legacy V1 path (history preserved) ----------
          const dimensions = deriveDimensions(aj);
          const overall = computeOverallScore(dimensions);
          if (overall === null) throw new Error("dimension derivation produced invalid scores");
          insert = {
            event_id: job.entity_id, scoring_version: "1.0.0", analysis_id: an.id,
            severity_score: dimensions.severity, probability_score: dimensions.probability,
            geographic_score: dimensions.geographic, duration_score: dimensions.duration,
            supply_chain_score: dimensions.supply_chain, economic_score: dimensions.economic,
            overall_score: overall,
            explanation: buildExplanation(dimensions, overall, aj),
            confidence: an.confidence ?? aj.confidence_level ?? null,
          };
          results.scored_legacy++;
        }

        const { error: insErr } = await db.from("risk_scores").insert(insert);
        if (insErr) throw new Error("score store failed: " + insErr.message);
        await db.from("processing_jobs").update({ status: "completed", completed_at: new Date().toISOString(), last_error: null }).eq("id", job.id);
        results.scored++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const exhausted = job.attempts + 1 >= MAX_ATTEMPTS;
        await db.from("processing_jobs").update({ status: exhausted ? "failed" : "pending", last_error: message }).eq("id", job.id);
        if (exhausted) results.failed++;
        else results.retried++;
      }
    }

    return jsonResponse({ status: "ok", function: "calculate-risk", timestamp: new Date().toISOString(), ...results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[PRISM] calculate-risk failed:", message);
    return jsonResponse({ status: "error", function: "calculate-risk", error: message }, 500);
  }
});
