// PRISM — live V2 schema check (run after applying migrations 0006/0007).
// Uses ONLY the public publishable key. anon has zero privileges, so:
//   42501 permission denied  => table/column EXISTS (good)
//   PGRST205 / PGRST204      => table/column MISSING (migration not applied)
// Run: node projects/prism/test/live-v2-schema-check.mjs
import { config } from "../frontend/js/config.js";
const H = { apikey: config.supabaseAnonKey, Authorization: "Bearer " + config.supabaseAnonKey };
let pass = 0, fail = 0;
async function probe(name, path) {
  const res = await fetch(config.supabaseUrl + "/rest/v1/" + path, { headers: H });
  const body = await res.json().catch(() => ({}));
  const code = body?.code ?? "";
  const exists = code === "42501";
  const missing = code === "PGRST205" || code === "PGRST204";
  if (exists) { pass++; console.log("  ok  " + name + " exists (anon denied as designed)"); }
  else if (missing) { fail++; console.error("FAIL  " + name + " MISSING — " + code + ": " + (body?.message ?? "")); }
  else { fail++; console.error("FAIL  " + name + " unexpected: HTTP " + res.status + " " + JSON.stringify(body).slice(0, 160)); }
}
console.log("[1] migration 0007 — company tables");
for (const t of ["company_profiles", "company_industries", "company_commodities", "company_products", "company_countries", "company_dependencies"]) {
  await probe(t, t + "?select=id&limit=1");
}
console.log("[2] migration 0006 — risk v2 columns");
for (const c of ["scoring_version", "likelihood_level", "likelihood_horizon_days", "confidence_level", "ongoing", "impact_index", "escalation_score", "persistence_score", "inputs"]) {
  await probe("risk_scores." + c, "risk_scores?select=" + c + "&limit=1");
}
await probe("analyses.inputs_hash", "analyses?select=inputs_hash&limit=1");
console.log("[3] baseline");
await probe("events (V1 table)", "events?select=id&limit=1");
console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
