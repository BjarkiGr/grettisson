// PRISM — health-check Edge Function.
// Reports backend availability, configuration presence (booleans only,
// never secret values) and recent processing activity from the database.

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { readProviderConfig } from "../_shared/ai-provider.ts";
import { createServiceClient } from "../_shared/database.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const activity: Record<string, unknown> = {};
  try {
    const db = createServiceClient();
    for (const table of ["sources", "articles", "events", "analyses", "risk_scores"]) {
      const { count, error } = await db.from(table).select("id", { count: "exact", head: true });
      activity[table] = error ? "error: " + error.message : count;
    }
    const jobs: Record<string, unknown> = {};
    for (const status of ["pending", "running", "completed", "failed", "paused"]) {
      const { count, error } = await db.from("processing_jobs").select("id", { count: "exact", head: true }).eq("status", status);
      jobs[status] = error ? "error: " + error.message : count;
    }
    activity.jobs_by_status = jobs;
    const { data: failedJobs } = await db.from("processing_jobs")
      .select("job_type, last_error, updated_at").eq("status", "failed")
      .order("updated_at", { ascending: false }).limit(5);
    activity.recent_failed_jobs = failedJobs ?? [];
    const { data: jobErrors } = await db.from("processing_jobs")
      .select("job_type, status, attempts, last_error, updated_at")
      .not("last_error", "is", null)
      .order("updated_at", { ascending: false }).limit(5);
    activity.recent_job_errors = jobErrors ?? [];
    const { data: lastSource } = await db.from("sources")
      .select("last_checked_at").order("last_checked_at", { ascending: false, nullsFirst: false }).limit(1);
    activity.last_ingestion_at = lastSource?.[0]?.last_checked_at ?? null;
    const { data: automation, error: autoErr } = await db.rpc("prism_automation_status");
    activity.automation = autoErr ? "unavailable (Phase 7 migration applied?)" : automation;
  } catch (err) {
    activity.error = err instanceof Error ? err.message : String(err);
  }

  return jsonResponse({
    status: "ok",
    service: "prism",
    version: "1.0.0",
    development_phase: 7,
    timestamp: new Date().toISOString(),
    checks: {
      supabase_url_present: Boolean(Deno.env.get("SUPABASE_URL")),
      service_role_key_present: Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
      ai_provider_configured: readProviderConfig() !== null,
    },
    activity,
    notes: [
      "Ingestion, processing and AI analysis are live (Phases 3-4).",
      "All pipeline functions live; cron automation in Phase 7.",
    ],
  });
});
