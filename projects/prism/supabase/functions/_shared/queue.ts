// PRISM V2.1 Phase 4 — queue reliability helpers (backend only).
import type { SupabaseClient } from "./database.ts";

export const STALE_RUNNING_MINUTES = 30;
export const MAX_ATTEMPTS = 3;

/** A failed job must never remain running indefinitely:
 *  running > 30 min -> pending (retry) or failed (attempts exhausted). */
export async function recoverStaleJobs(db: SupabaseClient): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_RUNNING_MINUTES * 60000).toISOString();
  const { data: retried } = await db.from("processing_jobs")
    .update({ status: "pending" })
    .eq("status", "running").lt("updated_at", cutoff).lt("attempts", MAX_ATTEMPTS)
    .select("id");
  const { data: dead } = await db.from("processing_jobs")
    .update({ status: "failed", last_error: "stale_running_timeout (dead-letter after max attempts)" })
    .eq("status", "running").lt("updated_at", cutoff).gte("attempts", MAX_ATTEMPTS)
    .select("id");
  return (retried?.length ?? 0) + (dead?.length ?? 0);
}
