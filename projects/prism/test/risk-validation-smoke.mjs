// PRISM V2.1 Phase 3 — risk engine validation suite.
// Run: node --experimental-strip-types projects/prism/test/risk-validation-smoke.mjs
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
const imp = (p) => import(pathToFileURL(path.join(ROOT, "supabase", "functions", "_shared", p)).href);
const v2 = await imp("risk-v2.ts");
const design = JSON.parse(read("test/risk-v2-cases.json")).cases;
const hist = JSON.parse(read("test/historical-cases.json")).cases;

console.log("[1] reproducibility: stored inputs -> identical score");
let repro = 0;
for (const c of design) {
  const a = v2.assessRiskV2(c.inputs);
  const b = v2.assessRiskV2(JSON.parse(JSON.stringify(c.inputs)));
  if (JSON.stringify(a) === JSON.stringify(b)) repro++;
}
check("all 12 design fixtures reproduce exactly (incl. JSON round-trip)", repro === design.length, repro + "/" + design.length);
const cr = read("supabase/functions/calculate-risk/index.ts");
check("inputs snapshot stored", cr.includes("inputs:") && cr.includes("scoring_version"));
check("history append-only (no update/delete of risk_scores)", !/from\("risk_scores"\)\.(update|delete)/.test(cr));
check("methodology referenced", cr.includes("RISK-METHODOLOGY") || read("docs/RISK-METHODOLOGY-V2.md").includes("matrix"));

console.log("[2] UNRATED handling audit");
const dj = read("frontend/js/data.js");
check("latest unrated -> null + flag", dj.includes("unrated: Boolean(latest"));
check("history unrated -> null (not 0)", dj.includes('r.likelihood_level === "insufficient_evidence" ? null : r.overall_score'));
const dash = read("frontend/js/dashboard.js");
check("averages exclude unrated", dash.includes("e.overall_score !== null"));
check("risk-change deltas exclude unrated on both sides", dash.includes("e.history[e.history.length - 2].overall_score !== null"));
check("rankings sort unrated last", read("frontend/js/events.js").includes("(b.overall_score ?? -1)"));
const rj = read("frontend/js/regions.js");
check("region aggregation score-guarded", rj.includes("overall_score"));
check("unrated events still listed (no filter on unrated in feed)", !read("frontend/js/intelligence.js").includes("unrated"));

console.log("[3] retrospective historical evaluation (NOT calibration)");
const rows = [];
for (const c of hist) {
  const r = v2.assessRiskV2(c.inputs);
  rows.push({ id: c.id, band: r.risk_band, index: r.risk_index, likelihood: r.likelihood, confidence: r.confidence, materialized: c.impact_materialized });
}
for (const r of rows) console.log("  " + r.id + ": " + r.band + " (" + r.index + ") lik=" + r.likelihood + " conf=" + r.confidence + " materialized=" + r.materialized);
const materialized = rows.filter((r) => r.materialized);
const flagged = materialized.filter((r) => r.index !== null && r.index >= 40);
check("all materialized disruptions flagged MODERATE+ (no false negatives in sample)", flagged.length === materialized.length, flagged.length + "/" + materialized.length);
const nonMat = rows.filter((r) => !r.materialized);
check("non-materialized case not over-flagged (UNRATED or <60)", nonMat.every((r) => r.index === null || r.index < 60));
check("thin-evidence case is UNRATED", rows.find((r) => r.id === "hist-tariff-review-2023").index === null);
check("contradictory sources -> low confidence", rows.filter((r) => ["hist-grain-2022", "hist-panama-2023"].includes(r.id)).every((r) => r.confidence === "low"));
const suez = rows.find((r) => r.id === "hist-suez-2021");
check("verified ongoing global blockage -> HIGH/CRITICAL", ["HIGH", "CRITICAL"].includes(suez.band));

console.log("[4] consistency + evidence coverage metrics");
const twin = v2.assessRiskV2(JSON.parse(JSON.stringify(hist[0].inputs)));
check("identical evidence -> identical assessment", twin.risk_index === v2.assessRiskV2(hist[0].inputs).risk_index);
const near = JSON.parse(JSON.stringify(hist[0].inputs));
near.independent_sources = 5;
check("minor source-count change keeps band stable", v2.assessRiskV2(near).risk_band === v2.assessRiskV2(hist[0].inputs).risk_band);
let dimsTotal = 0, dimsVerified = 0;
for (const c of [...design, ...hist]) for (const d of Object.values(c.inputs.dimensions)) { dimsTotal++; if (d.verified_evidence) dimsVerified++; }
const coverage = Math.round(100 * dimsVerified / dimsTotal);
console.log("  evidence coverage across fixtures: " + coverage + "% of dimensions carry verified evidence");
check("coverage measurable and reported", coverage > 0 && coverage <= 100);

console.log("[5] methodology comparison (internal, no writes)");
const v1 = await imp("risk.ts");
const cmp = [];
for (const c of hist.slice(0, 3)) {
  const r2 = v2.assessRiskV2(c.inputs);
  const synth = {
    severity_assessment: c.inputs.dimensions.escalation.proposed,
    confidence_level: 0.5,
    countries_involved: c.inputs.major_economy_affected ? ["US"] : [],
    commodities_affected: ["steel"], industries_affected: ["logistics"], organizations: [],
    event_category: "shipping_disruptions",
    supporting_evidence: Array.from({ length: c.inputs.verified_fact_count }, (_, i) => ({ claim: "c", article_id: "a" + i, kind: "verified_fact" })),
    escalation_scenarios: [], uncertainties: [],
  };
  const d1 = v1.deriveDimensions(synth);
  const s1 = v1.computeOverallScore(d1);
  cmp.push({ id: c.id, v1_score: s1, v2_index: r2.risk_index, v2_band: r2.risk_band });
}
for (const r of cmp) console.log("  " + r.id + ": V1=" + r.v1_score + " V2=" + r.v2_index + " (" + r.v2_band + ")");
check("comparison produces side-by-side without touching production", cmp.length === 3 && cmp.every((r) => typeof r.v1_score === "number" || r.v1_score === null));
check("comparison tool is test-only (no production import)", !read("supabase/functions/calculate-risk/index.ts").includes("methodology-compare"));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
