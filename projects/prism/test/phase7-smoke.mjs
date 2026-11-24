// PRISM — Phase 7 smoke test. Zero dependencies.
// Run: node projects/prism/test/phase7-smoke.mjs
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  ok  " + name); }
  else { fail++; console.error("FAIL  " + name + (detail ? " — " + detail : "")); }
}
const read = (p) => readFileSync(p, "utf8").replace(/^\uFEFF/, "");

console.log("[1] automation migration");
const migPath = path.join(ROOT, "supabase", "migrations", "20261126000000_automation.sql");
check("migration exists", existsSync(migPath));
const sql = read(migPath);
check("pg_cron + pg_net", sql.includes("create extension if not exists pg_cron") && sql.includes("create extension if not exists pg_net"));
check("cron_runs history table", sql.includes("create table if not exists public.cron_runs"));
check("cron_runs RLS + read policy", sql.includes("alter table public.cron_runs enable row level security") && sql.includes("cron_runs_read_authenticated"));
check("vault-backed invoker", sql.includes("vault.decrypted_secrets") && sql.includes("prism_service_key"));
check("function whitelist", sql.includes("if fn_name not in ('ingest-sources', 'process-articles', 'analyze-events', 'calculate-risk', 'health-check')"));
check("overlap guard", sql.includes("status = 'invoked'") && sql.includes("interval '10 minutes'"));
check("missing-secret recorded, not fatal", sql.includes("vault secret prism_service_key missing"));
check("reaper joins net responses", sql.includes("net._http_response") && sql.includes("reap_cron_responses"));
check("stale invocation timeout", sql.includes("no response within 30 minutes"));
check("response cleanup", sql.includes("delete from net._http_response"));
check("status function (no secrets)", sql.includes("prism_automation_status") && sql.includes("vault_configured"));
check("invoker not callable by anon", sql.includes("revoke all on function public.invoke_edge_function(text) from public, anon"));

console.log("[2] schedules");
const schedules = [
  ["prism-ingest", "*/30 * * * *", "ingest-sources"],
  ["prism-process", "*/15 * * * *", "process-articles"],
  ["prism-analyze", "*/15 * * * *", "analyze-events"],
  ["prism-risk", "0 * * * *", "calculate-risk"],
  ["prism-health", "0 6 * * *", "health-check"],
];
for (const [name, expr, fn] of schedules) {
  check(name + " schedule", sql.includes("cron.schedule('" + name + "', '" + expr + "'") && sql.includes("invoke_edge_function('" + fn + "')"));
  check(name + " idempotent unschedule", sql.includes("cron.unschedule('" + name + "')"));
}
check("reap schedule */5", sql.includes("cron.schedule('prism-reap', '*/5 * * * *'"));

console.log("[3] no secrets committed");
check("no real service key / JWT in SQL", !/sb_secret_[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{20}/.test(sql));
check("vault insert only as placeholder comment", !/^\s*select vault\.create_secret\('\w/m.test(sql));
const hc = read(path.join(ROOT, "supabase", "functions", "health-check", "index.ts"));
check("health-check reports automation", hc.includes('db.rpc("prism_automation_status")'));
check("health-check phase 7", hc.includes("development_phase: 7"));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail === 0 ? 0 : 1;
