// PRISM V2.1 Phase 4 — system-status (authenticated, sanitized).
// Read-only system health for the Settings page. NO error strings, NO
// cron excerpts, NO secrets — counts and timestamps only.
// States (deterministic, documented in docs/OPERATIONS.md):
//   PAUSED   AI jobs paused (quota/rate window)
//   FAILED   no ingestion ever, or last ingestion > 72h ago
//   DEGRADED last ingestion > 24h ago, or > 5 failed jobs
//   DELAYED  last ingestion > 2h ago (cron cadence is 30 min)
//   HEALTHY  otherwise
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/database.ts";
import { readProviderConfig } from "../_shared/ai-provider.ts";

Deno.serve(async (req: Request) => {
  const pre = handleCorsPreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return jsonResponse({ error: "missing_token" }, 401);
    const db = createServiceClient();
    const { data: userData, error: userErr } = await db.auth.getUser(jwt);
    if (userErr || !userData?.user) return jsonResponse({ error: "invalid_token" }, 401);

    const jobs: Record<string, number> = {};
    for (const status of ["pending", "running", "failed", "paused"]) {
      const { count } = await db.from("processing_jobs").select("id", { count: "exact", head: true }).eq("status", status);
      jobs[status] = count ?? 0;
    }
    const lastOf = async (table: string, col: string) => {
      const { data } = await db.from(table).select(col).order(col, { ascending: false, nullsFirst: false }).limit(1);
      return data?.[0]?.[col] ?? null;
    };
    const lastIngest = await lastOf("sources", "last_checked_at");
    const lastAnalysis = await lastOf("analyses", "created_at");
    const lastRisk = await lastOf("risk_scores", "created_at");
    const ageH = lastIngest ? (Date.now() - Date.parse(lastIngest)) / 3600000 : Infinity;
    let state = "HEALTHY";
    if (jobs.paused > 0) state = "PAUSED";
    else if (!lastIngest || ageH > 72) state = "FAILED";
    else if (ageH > 24 || jobs.failed > 5) state = "DEGRADED";
    else if (ageH > 2) state = "DELAYED";
    return jsonResponse({
      state,
      jobs,
      last_ingestion_at: lastIngest,
      last_analysis_at: lastAnalysis,
      last_risk_at: lastRisk,
      ai_configured: readProviderConfig() !== null,
    });
  } catch (_e) {
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
