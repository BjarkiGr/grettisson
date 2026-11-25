// Safe live security probes (Phase 0 audit). Read-only / 401 paths only.
import { config } from "../frontend/js/config.js";
const base = config.supabaseUrl + "/functions/v1/";
const anon = { apikey: config.supabaseAnonKey, Authorization: "Bearer " + config.supabaseAnonKey, "Content-Type": "application/json" };
// 1. health-check with the PUBLIC anon key: read-only, but should it be public?
const h = await fetch(base + "health-check", { headers: anon });
const hb = await h.json().catch(() => ({}));
console.log("health-check(anon): HTTP " + h.status + " | exposes jobs_by_status=" + Boolean(hb?.activity?.jobs_by_status) + " recent_job_errors=" + Boolean(hb?.activity?.recent_job_errors) + " automation=" + Boolean(hb?.activity?.automation));
if (hb?.activity) { console.log("  counts:", JSON.stringify({ articles: hb.activity.articles, events: hb.activity.events, analyses: hb.activity.analyses, risk_scores: hb.activity.risk_scores, jobs: hb.activity.jobs_by_status })); console.log("  last_ingestion_at:", hb.activity.last_ingestion_at); console.log("  automation:", JSON.stringify(hb.activity.automation).slice(0, 400)); }
// 2. user-facing functions with anon key (no user JWT): must be 401.
for (const fn of ["manage-users", "reclassify-articles", "extract-company-profile", "match-company-events"]) {
  const r = await fetch(base + fn, { method: "POST", headers: anon, body: "{}" });
  const b = await r.json().catch(() => ({}));
  console.log(fn + "(anon): HTTP " + r.status + " " + JSON.stringify(b).slice(0, 100) + (r.status === 401 ? "  [OK gated]" : "  [REVIEW]"));
}
// 3. invalid JWT on manage-users: must be 401.
const bad = await fetch(base + "manage-users", { method: "POST", headers: { ...anon, Authorization: "Bearer invalid.jwt.token" }, body: "{}" });
console.log("manage-users(bad jwt): HTTP " + bad.status + (bad.status === 401 ? "  [OK gated]" : "  [REVIEW]"));
// 4. anon RPC on privileged functions: must be denied.
for (const rpc of ["invoke_edge_function", "prism_automation_status"]) {
  const r = await fetch(config.supabaseUrl + "/rest/v1/rpc/" + rpc, { method: "POST", headers: anon, body: rpc === "invoke_edge_function" ? '{"fn_name":"health-check"}' : "{}" });
  const b = await r.json().catch(() => ({}));
  console.log("rpc " + rpc + "(anon): HTTP " + r.status + " code=" + (b?.code ?? "?") + (r.status >= 400 ? "  [OK denied]" : "  [REVIEW]"));
}
