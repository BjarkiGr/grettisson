// PRISM — Phase 2 LIVE verification against the configured Supabase project.
// Uses only PUBLIC values from frontend/js/config.js. Zero dependencies.
// Run: node projects/prism/test/phase2-live.mjs
// Expected security model: anon has NO table privileges (401/42501 on reads
// and writes); auth endpoint alive; invalid credentials rejected.
// Signed-in admin reads are verified in the browser via settings.html.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { config, isConfigured } = await import(pathToFileURL(path.join(ROOT, "frontend", "js", "config.js")).href);

if (!isConfigured()) {
  console.error("config.js is not configured — nothing to test live.");
  process.exit(1);
}
const BASE = config.supabaseUrl.replace(/\/+$/, "");
const KEY = config.supabaseAnonKey;
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  ok  " + name + (detail ? " — " + detail : "")); }
  else { fail++; console.error("FAIL  " + name + (detail ? " — " + detail : "")); }
}

console.log("[1] anon reads denied on every table (no privileges + RLS)");
for (const t of ["sources","articles","events","event_articles","analyses","risk_scores","profiles","watchlists","event_watchlists","processing_jobs"]) {
  const r = await fetch(BASE + "/rest/v1/" + t + "?limit=1", { headers: H });
  const body = await r.text();
  check("anon denied " + t, r.status === 401 || r.status === 403, "HTTP " + r.status + " " + body.slice(0, 80));
}

console.log("[2] anon writes rejected");
for (const [t, payload] of [["events", { title: "RLS probe", category: "sanctions" }], ["sources", { name: "RLS probe", url: "https://example.com/probe" }], ["risk_scores", { event_id: "00000000-0000-0000-0000-000000000000", severity_score: 1, probability_score: 1, geographic_score: 1, duration_score: 1, supply_chain_score: 1, economic_score: 1, overall_score: 20 }]]) {
  const r = await fetch(BASE + "/rest/v1/" + t, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(payload) });
  check("anon insert rejected " + t, r.status === 401 || r.status === 403, "HTTP " + r.status);
}

console.log("[3] auth endpoint");
const ah = await fetch(BASE + "/auth/v1/health", { headers: { apikey: KEY } });
check("auth health 200", ah.status === 200, "HTTP " + ah.status);
const bad = await fetch(BASE + "/auth/v1/token?grant_type=password", {
  method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "nobody@example.com", password: "definitely-not-a-real-password" }),
});
const badBody = await bad.text();
check("invalid login rejected", bad.status === 400 || bad.status === 401, "HTTP " + bad.status + " " + badBody.slice(0, 100));

console.log("\n" + pass + " passed, " + fail + " failed");
console.log("note  signed-in admin reads: verify in browser via settings.html -> Run read tests");
process.exitCode = fail === 0 ? 0 : 1;
