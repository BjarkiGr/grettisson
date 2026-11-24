// PRISM — Phase 5 smoke test. Zero dependencies.
// Run: node --experimental-strip-types projects/prism/test/phase5-smoke.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHARED = path.join(ROOT, "supabase", "functions", "_shared");
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  ok  " + name); }
  else { fail++; console.error("FAIL  " + name + (detail ? " — " + detail : "")); }
}
const imp = (dir, f) => import(pathToFileURL(path.join(dir, f)).href);
const read = (p) => readFileSync(p, "utf8").replace(/^\uFEFF/, "");

const risk = await imp(SHARED, "risk.ts");
const utils = await imp(path.join(ROOT, "frontend", "js"), "utils.js");

const base = {
  event_title: "T", executive_summary: "S", event_category: "sanctions",
  countries_involved: ["RU", "DE"], geographic_region: "Europe",
  organizations: [], commodities_affected: ["natural-gas"], industries_affected: ["energy"],
  supply_chain_implications: "x", economic_consequences: "x", escalation_scenarios: [],
  severity_assessment: 3, confidence_level: 0.6,
  supporting_evidence: [{ claim: "c", article_id: "a1", kind: "verified_fact" }],
  uncertainties: [], source_references: ["https://example.com/a"],
};
const derive = (over) => risk.deriveDimensions({ ...base, ...over });

console.log("[1] dimension derivation rules");
check("severity passthrough", derive({}).severity === 3);
check("severity clamped", derive({ severity_assessment: 9 }).severity === 5);
check("probability all-verified -> 5", derive({}).probability === 5);
check("probability half-verified -> 3", derive({ supporting_evidence: [{ kind: "verified_fact" }, { kind: "inference" }] }).probability === 3);
check("probability none-verified -> 1", derive({ supporting_evidence: [{ kind: "speculation" }] }).probability === 1);
check("probability empty evidence -> 1", derive({ supporting_evidence: [] }).probability === 1);
check("geographic 0 countries -> 1", derive({ countries_involved: [] }).geographic === 1);
check("geographic 1 -> 2", derive({ countries_involved: ["RU"] }).geographic === 2);
check("geographic 3 -> 3", derive({ countries_involved: ["RU", "DE", "FR"] }).geographic === 3);
check("geographic 5 -> 4", derive({ countries_involved: ["RU", "DE", "FR", "IT", "ES"] }).geographic === 4);
check("geographic 8 -> 5", derive({ countries_involved: ["RU", "DE", "FR", "IT", "ES", "NL", "BE", "PL"] }).geographic === 5);
check("geographic Global -> 5", derive({ geographic_region: "Global" }).geographic === 5);
check("duration sanctions -> 4", derive({}).duration === 4);
check("duration natural_disasters -> 1", derive({ event_category: "natural_disasters" }).duration === 1);
check("duration military -> 4", derive({ event_category: "military_conflict" }).duration === 4);
check("supply 1 commodity + trade cat -> 3", derive({}).supply_chain === 3);
check("supply 0 commodities + trade cat -> 2", derive({ commodities_affected: [] }).supply_chain === 2);
check("supply 4 commodities capped 5", derive({ commodities_affected: ["a", "b", "c", "d"] }).supply_chain === 5);
check("supply non-trade no boost", derive({ event_category: "diplomatic_developments" }).supply_chain === 2);
check("economic 1 industry -> 2", derive({}).economic === 2);
check("economic 4 industries -> 5", derive({ industries_affected: ["a", "b", "c", "d"] }).economic === 5);
check("economic 0 industries -> 1", derive({ industries_affected: [] }).economic === 1);

console.log("[2] formula + bands");
const dims = (s, p, g, d, sc, e) => ({ severity: s, probability: p, geographic: g, duration: d, supply_chain: sc, economic: e });
check("all zero -> 0", risk.computeOverallScore(dims(0, 0, 0, 0, 0, 0)) === 0);
check("all five -> 100", risk.computeOverallScore(dims(5, 5, 5, 5, 5, 5)) === 100);
check("known vector -> 85", risk.computeOverallScore(dims(5, 4, 4, 3, 5, 4)) === 85);
check("invalid -> null", risk.computeOverallScore(dims(6, 0, 0, 0, 0, 0)) === null);
const bands = [[0, "MINIMAL"], [19, "MINIMAL"], [20, "LOW"], [39, "LOW"], [40, "MODERATE"], [59, "MODERATE"], [60, "HIGH"], [79, "HIGH"], [80, "CRITICAL"], [100, "CRITICAL"]];
for (const [s, l] of bands) check("band " + s + " -> " + l, risk.riskLevelFromScore(s) === l);

console.log("[3] explanation");
const d = derive({});
const overall = risk.computeOverallScore(d);
const ex = risk.buildExplanation(d, overall, base);
check("explanation has overall + level", ex.includes("Overall " + overall + "/100"));
check("explanation lists all dimensions", ["severity", "probability", "geographic", "duration", "supply_chain", "economic"].every((k) => ex.includes(k + "=")));
check("explanation has formula", ex.includes("Formula:"));
check("explanation flags estimate nature", ex.includes("analytical estimate"));

console.log("[4] frontend/backend parity");
check("weights identical", JSON.stringify(risk.RISK_WEIGHTS) === JSON.stringify(utils.RISK_WEIGHTS));
let parity = true;
for (let s = 0; s <= 5; s++) for (const p of [1, 3, 5]) {
  const v = dims(s, p, 3, 2, 4, 3);
  if (risk.computeOverallScore(v) !== utils.computeOverallScore(v)) parity = false;
}
check("computeOverallScore parity (90 vectors)", parity);
let bandParity = true;
for (let s = 0; s <= 100; s++) if (risk.riskLevelFromScore(s) !== utils.riskLevelFromScore(s)) bandParity = false;
check("band parity 0-100", bandParity);

console.log("[5] calculate-risk structure");
const cr = read(path.join(ROOT, "supabase", "functions", "calculate-risk", "index.ts"));
check("batch limit", cr.includes("BATCH_SIZE = 10"));
check("atomic claim", cr.includes('.eq("status", "pending")') && cr.includes('status: "running"'));
check("append-only (insert, no update/delete on risk_scores)", cr.includes('from("risk_scores").insert') && !/from("risk_scores")\.(update|delete)/.test(cr));
check("confidence stored separately", cr.includes("confidence,"));
check("bounded retries", cr.includes("MAX_ATTEMPTS = 3"));
check("latest analysis used", cr.includes('order("created_at", { ascending: false })'));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail === 0 ? 0 : 1;
