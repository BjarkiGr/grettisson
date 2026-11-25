// PRISM V2 — risk engine acceptance test (12 methodology fixtures).
// Run: node --experimental-strip-types projects/prism/test/risk-v2-engine-smoke.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { assessRiskV2, RISK_MATRIX, V2_WEIGHTS, SCORING_VERSION } = await import(pathToFileURL(path.join(ROOT, "supabase", "functions", "_shared", "risk-v2.ts")).href);
const data = JSON.parse(readFileSync(path.join(ROOT, "test", "risk-v2-cases.json"), "utf8"));
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  ok  " + name); }
  else { fail++; console.error("FAIL  " + name + (detail ? " — " + detail : "")); }
}
console.log("[1] engine vs methodology fixtures");
for (const c of data.cases) {
  const r = assessRiskV2(c.inputs);
  const ok = r.likelihood === c.expected.likelihood && r.confidence === c.expected.confidence && r.impact_band === c.expected.impact_band && r.risk_band === c.expected.risk_band;
  check(c.id + " " + c.title.slice(0, 40), ok, JSON.stringify({ got: { l: r.likelihood, c: r.confidence, ib: r.impact_band, rb: r.risk_band }, want: c.expected }));
}
console.log("[2] engine invariants");
check("scoring version", SCORING_VERSION === "2.0.0");
check("weights match methodology", JSON.stringify(V2_WEIGHTS) === JSON.stringify(data.weights));
let monotonic = true;
const rows = Object.values(RISK_MATRIX);
for (const row of rows) for (let i = 1; i < row.length; i++) if (row[i] <= row[i-1]) monotonic = false;
for (let c = 0; c < 5; c++) for (let r = 1; r < rows.length; r++) if (rows[r][c] <= rows[r-1][c]) monotonic = false;
check("matrix monotonic both axes", monotonic);
check("matrix ceiling 95", Math.max(...rows.flat()) === 95);
const unrated = assessRiskV2({ ...data.cases[1].inputs });
check("unrated has null index but impact shown", unrated.risk_index === null && unrated.impact_index > 0);
const gamed = assessRiskV2(data.cases[11].inputs);
check("anti-gaming: gates recorded", gamed.gate_notes.length >= 4);
check("no numeric probability anywhere", !JSON.stringify(gamed).includes("probability"));
console.log("[3] frontend/backend parity");
const utils = await import(pathToFileURL(path.join(ROOT, "frontend", "js", "utils.js")).href);
check("V2 weights parity", JSON.stringify(utils.V2_WEIGHTS) === JSON.stringify(V2_WEIGHTS));
check("V2 matrix parity", JSON.stringify(utils.RISK_MATRIX_V2) === JSON.stringify(RISK_MATRIX));
let impactParity = true;
for (const c of data.cases) {
  const r = assessRiskV2(c.inputs);
  if (utils.computeImpactIndexV2(r.gated) !== r.impact_index) impactParity = false;
  if (utils.impactBandV2(r.impact_index) !== r.impact_band) impactParity = false;
}
check("impact computation parity (12 fixtures)", impactParity);

console.log("[4] V2 output validation");
const { validateAnalysisOutputV2 } = await import(pathToFileURL(path.join(ROOT, "supabase", "functions", "_shared", "analysis-validation.ts")).href);
const IDS = ["a1", "a2"]; const URLS = ["https://example.com/1", "https://example.com/2"];
const dim = (score) => ({ proposed_score: score, rationale: "r", evidence_article_ids: ["a1"], uncertainty: "" });
const v2ok = {
  event_title: "T", executive_summary: "S", event_category: "sanctions",
  countries_involved: ["RU"], geographic_region: "Europe", organizations: [],
  commodities_affected: ["steel"], industries_affected: ["construction"],
  supply_chain_implications: "x", economic_consequences: "x", escalation_scenarios: [],
  severity_assessment: 3, confidence_level: 0.6,
  supporting_evidence: [{ claim: "c", article_id: "a1", kind: "verified_fact" }],
  uncertainties: [], source_references: ["https://example.com/1"],
  dimensions: { escalation: dim(2), economic: dim(3), supply_chain: dim(2), geographic: dim(2), strategic: dim(1), persistence: dim(3) },
  likelihood: { outcome: "measures take effect", horizon_days: 90, level: "moderate", rationale: "r", evidence_article_ids: ["a1"], ongoing_claim: false },
  confidence_inputs: { material_contradictions: [], evidence_gaps: [] },
};
check("valid v2 accepted", validateAnalysisOutputV2(v2ok, IDS, URLS).ok === true);
const mut = (fn) => { const c = JSON.parse(JSON.stringify(v2ok)); fn(c); return validateAnalysisOutputV2(c, IDS, URLS); };
check("missing dimensions rejected", mut((c) => { delete c.dimensions; }).ok === false);
check("out-of-range proposal rejected", mut((c) => { c.dimensions.economic.proposed_score = 7; }).ok === false);
check("fabricated dimension citation rejected", mut((c) => { c.dimensions.economic.evidence_article_ids = ["a99"]; }).ok === false);
check("bad likelihood level rejected", mut((c) => { c.likelihood.level = "certain"; }).ok === false);
check("missing horizon rejected", mut((c) => { delete c.likelihood.horizon_days; }).ok === false);
check("non-boolean ongoing rejected", mut((c) => { c.likelihood.ongoing_claim = "yes"; }).ok === false);
check("missing confidence_inputs rejected", mut((c) => { delete c.confidence_inputs; }).ok === false);

console.log("[5] pipeline wiring");
const read2 = (p) => readFileSync(path.join(ROOT, p), "utf8");
const an = read2("supabase/functions/analyze-events/index.ts");
check("analyze uses v2 prompt", an.includes("SYSTEM_PROMPT_V2") && an.includes("PROMPT_VERSION_V2"));
check("analyze uses v2 validation", an.includes("validateAnalysisOutputV2"));
check("change detection present", an.includes("inputsHash") && an.includes("skipped_unchanged") && an.includes("7 * 86400000"));
const cr = read2("supabase/functions/calculate-risk/index.ts");
check("calculate uses v2 engine", cr.includes("assessRiskV2") && cr.includes("SCORING_VERSION"));
check("legacy fallback preserved", cr.includes("deriveDimensions") && cr.includes('scoring_version: "1.0.0"'));
check("inputs snapshot stored", cr.includes("inputs: { inputs"));
const mig = read2("supabase/migrations/20261129000000_risk_v2.sql");
check("migration versioning columns", mig.includes("scoring_version") && mig.includes("analysis_id") && mig.includes("inputs jsonb"));
check("migration v2 dimension columns", mig.includes("escalation_score") && mig.includes("persistence_score") && mig.includes("impact_index"));
check("migration inputs_hash", mig.includes("inputs_hash"));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
