// PRISM V2.1 Phase 1 — live security probes (assertion-based, safe paths).
// Run: node projects/prism/test/phase1-live-probes.mjs
import { config } from "../frontend/js/config.js";
const base = config.supabaseUrl + "/functions/v1/";
const anon = { apikey: config.supabaseAnonKey, Authorization: "Bearer " + config.supabaseAnonKey, "Content-Type": "application/json" };
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log("  ok  " + name); } else { fail++; console.error("FAIL  " + name + " — " + detail); } };
async function post(fn, headers, body) {
  const r = await fetch(base + fn, { method: "POST", headers, body: body ?? "{}" });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
console.log("[1] pipeline functions reject the public anon key");
for (const fn of ["ingest-sources", "process-articles", "analyze-events", "calculate-risk", "health-check"]) {
  const r = await post(fn, anon);
  check(fn + "(anon) -> 401", r.status === 401 && r.body?.error === "unauthorized", "HTTP " + r.status + " " + JSON.stringify(r.body).slice(0, 80));
}
console.log("[2] user-facing functions reject anon / bad JWT");
for (const fn of ["manage-users", "reclassify-articles", "extract-company-profile", "match-company-events"]) {
  const r = await post(fn, anon);
  check(fn + "(anon) -> 401", r.status === 401, "HTTP " + r.status + " " + JSON.stringify(r.body).slice(0, 80));
}
const bad = await post("manage-users", { ...anon, Authorization: "Bearer invalid.jwt.token" });
check("manage-users(bad jwt) -> 401", bad.status === 401, "HTTP " + bad.status);
console.log("[3] forged service-role claim rejected by gateway");
const forged = "eyJhbGciOiJIUzI1NiJ9." + Buffer.from('{"role":"service_role"}').toString("base64url") + ".badsignature";
const f = await post("health-check", { ...anon, Authorization: "Bearer " + forged });
check("forged service JWT -> 401", f.status === 401, "HTTP " + f.status + " " + JSON.stringify(f.body).slice(0, 80));
console.log("[4] privileged RPCs denied to anon");
for (const rpc of ["invoke_edge_function", "prism_automation_status"]) {
  const r = await fetch(config.supabaseUrl + "/rest/v1/rpc/" + rpc, { method: "POST", headers: anon, body: rpc === "invoke_edge_function" ? '{"fn_name":"health-check"}' : "{}" });
  check("rpc " + rpc + "(anon) denied", r.status >= 400, "HTTP " + r.status);
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
