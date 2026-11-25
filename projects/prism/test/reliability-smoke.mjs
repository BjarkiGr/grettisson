// PRISM V2.1 Phase 4 — pipeline reliability smoke test.
// Run: node --experimental-strip-types projects/prism/test/reliability-smoke.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  ok  " + name); }
  else { fail++; console.error("FAIL  " + name + (detail ? " — " + detail : "")); }
}
const read = (p) => readFileSync(path.join(ROOT, p), "utf8").replace(/^\uFEFF/, "");
const dd = await import(pathToFileURL(path.join(ROOT, "supabase", "functions", "_shared", "dedup.ts")).href);

console.log("[1] deterministic dedup similarity");
check("identical titles -> 1", dd.titleSimilarity("Steel tariffs announced by China", "Steel tariffs announced by China") === 1);
check("unrelated titles -> low", dd.titleSimilarity("Steel tariffs announced by China", "Brazilian harvest festival opens") < 0.1);
check("stopwords ignored", dd.titleTokens("the and of steel tariffs").has("steel") && !dd.titleTokens("the and of steel tariffs").has("the"));
const now = Date.parse("2026-12-01T00:00:00Z");
const fresh = { title: "China announces steel export tariffs", last_updated_at: "2026-11-30T00:00:00Z" };
const old = { title: "China announces steel export tariffs", last_updated_at: "2026-11-10T00:00:00Z" };
check("temporal proximity raises score", dd.eventSimilarity("China announces new steel export tariffs", fresh, now) > dd.eventSimilarity("China announces new steel export tariffs", old, now));
check("same-story match >= threshold", dd.eventSimilarity("China announces steel export tariffs", fresh, now) >= dd.MERGE_THRESHOLD);
check("different-story below threshold (no auto-merge)", dd.eventSimilarity("China signs trade deal with Brazil", fresh, now) < dd.MERGE_THRESHOLD);
check("empty titles safe", dd.eventSimilarity("", { title: "", last_updated_at: "2026-11-30T00:00:00Z" }, now) < dd.MERGE_THRESHOLD);

console.log("[2] queue reliability wiring");
const q = read("supabase/functions/_shared/queue.ts");
check("stale cutoff 30 min", q.includes("STALE_RUNNING_MINUTES = 30"));
check("retry below max attempts", q.includes('.lt("attempts", MAX_ATTEMPTS)'));
check("dead-letter at max attempts", q.includes('.gte("attempts", MAX_ATTEMPTS)') && q.includes("dead-letter"));
for (const fn of ["process-articles", "analyze-events", "calculate-risk"]) {
  const src = read("supabase/functions/" + fn + "/index.ts");
  check(fn + " recovers stale jobs", src.includes("await recoverStaleJobs(db);"));
  check(fn + " atomic claim intact", src.includes('.eq("status", "pending")'));
}
const pa = read("supabase/functions/process-articles/index.ts");
check("candidates widened to 10", pa.includes(".limit(10);"));
check("best-match selection", pa.includes("best.score >= MERGE_THRESHOLD"));

console.log("[3] retention migration 0009");
const sql = read("supabase/migrations/20261202000000_retention.sql");
check("completed 30d", sql.includes("status = 'completed' and completed_at < now() - interval '30 days'"));
check("failed 90d", sql.includes("status = 'failed' and updated_at < now() - interval '90 days'"));
check("cron history 90d", sql.includes("cron_runs") && sql.includes("invoked_at < now() - interval '90 days'"));
check("no article deletion (licensing deferred)", !sql.includes("delete from public.articles"));
check("definer + search_path", sql.includes("security definer set search_path = public, cron"));
check("anon/authenticated revoked", sql.includes("revoke all on function public.prism_retention_cleanup() from public, anon, authenticated"));
check("daily schedule", sql.includes("cron.schedule('prism-retention', '30 3 * * *'"));

console.log("[4] system-status + monitoring");
const ss = read("supabase/functions/system-status/index.ts");
check("JWT gate", ss.includes("auth.getUser(jwt)"));
check("all five states", ["HEALTHY", "DELAYED", "DEGRADED", "PAUSED", "FAILED"].every((s) => ss.includes('"' + s + '"')));
check("no error strings exposed", !ss.includes("last_error") && !ss.includes("recent_job_errors"));
check("generic 500", ss.includes('error: "internal_error"'));
const st = read("frontend/js/settings.js");
check("settings health panel", st.includes("loadSystemHealth") && st.includes('"system-status"'));
check("health values escaped", st.includes("escapeHtml(data.state)"));
check("ops + backup docs exist", read("docs/OPERATIONS.md").includes("HEALTHY") && read("docs/BACKUP-RECOVERY.md").includes("pg_dump"));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
