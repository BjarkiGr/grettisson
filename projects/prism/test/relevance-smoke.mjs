// PRISM V2 Phase 3 — relevance engine smoke test. Zero dependencies.
// Run: node --experimental-strip-types projects/prism/test/relevance-smoke.mjs
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
const rel = await import(pathToFileURL(path.join(ROOT, "supabase", "functions", "_shared", "relevance.ts")).href);

const P = (over = {}) => ({
  industries: [{ industry: "construction", origin: "user_supplied" }],
  commodities: [{ commodity_slug: "steel", origin: "user_supplied" }],
  countries: [{ country_code: "CN", role: "supplier", origin: "user_supplied" }, { country_code: "IS", role: "operating", origin: "user_supplied" }],
  dependencies: [{ kind: "chokepoint", ref: "Suez Canal", confirmed: true, origin: "user_supplied" }],
  ...over,
});
const E = (over = {}) => ({ commodity_slugs: [], country_codes: [], industries: [], chokepoints: [], ...over });

console.log("[1] exposure classes");
check("direct: commodity + supplier country", rel.matchProfileToEvent(P(), E({ commodity_slugs: ["steel"], country_codes: ["CN"] })).exposure === "direct");
check("direct: operating country + industry", rel.matchProfileToEvent(P(), E({ country_codes: ["IS"], industries: ["construction"] })).exposure === "direct");
check("inferred: commodity only", rel.matchProfileToEvent(P(), E({ commodity_slugs: ["steel"] })).exposure === "inferred");
check("inferred: supplier country only", rel.matchProfileToEvent(P(), E({ country_codes: ["CN"] })).exposure === "inferred");
check("indirect: industry only", rel.matchProfileToEvent(P({ commodities: [], countries: [] }), E({ industries: ["construction"] })).exposure === "indirect");
check("indirect: chokepoint dependency", rel.matchProfileToEvent(P({ commodities: [], countries: [], industries: [] }), E({ chokepoints: ["Suez Canal disruption"] })).exposure === "indirect");
check("none: no overlap", rel.matchProfileToEvent(P(), E({ commodity_slugs: ["lng"], country_codes: ["BR"] })).exposure === "none");
check("unconfirmed dependency never matches", rel.matchProfileToEvent(P({ commodities: [], countries: [], industries: [], dependencies: [{ kind: "chokepoint", ref: "Suez Canal", confirmed: false, origin: "ai_confirmed" }] }), E({ chokepoints: ["Suez Canal"] })).exposure === "none");

console.log("[2] scoring: separate, bounded, origin-aware");
const direct = rel.matchProfileToEvent(P(), E({ commodity_slugs: ["steel"], country_codes: ["CN"] }));
check("direct base+trusted", direct.relevance_score === 80, String(direct.relevance_score));
const aiOnly = rel.matchProfileToEvent(P({ commodities: [{ commodity_slug: "steel", origin: "ai_confirmed" }], countries: [{ country_code: "CN", role: "supplier", origin: "ai_confirmed" }] }), E({ commodity_slugs: ["steel"], country_codes: ["CN"] }));
check("ai-confirmed origins score lower", aiOnly.relevance_score === 75, String(aiOnly.relevance_score));
const many = rel.matchProfileToEvent(P(), E({ commodity_slugs: ["steel"], country_codes: ["CN", "IS"], industries: ["construction"], chokepoints: ["Suez Canal"] }));
check("score capped at 100", many.relevance_score <= 100);
check("none scores 0", rel.matchProfileToEvent(P(), E()).relevance_score === 0);

console.log("[3] transparent explanations");
check("explanation names commodity + origin", direct.explanation.includes("steel") && direct.explanation.includes("you listed"));
check("explanation names country role", direct.explanation.includes("supplier"));
check("every match has reason + origin", direct.matches.every((m) => m.reason.length > 10 && m.origin));
check("none explanation honest", rel.matchProfileToEvent(P(), E()).explanation.includes("No connection"));

console.log("[4] function privacy + wiring");
const fn = read("supabase/functions/match-company-events/index.ts");
check("JWT verified", fn.includes("auth.getUser(jwt)"));
check("profile loaded via caller client (RLS)", fn.includes('userClient.from("company_profiles")'));
check("service client only for shared data", !/svc\.from\("company_/.test(fn));
check("no writes anywhere", !/\.(insert|update|upsert|delete)\(/.test(fn));
check("no AI provider import", !fn.includes("ai-provider"));
check("unrated global risk mapped to null", fn.includes('risk_level === "insufficient_evidence" ? null'));
const dash = read("frontend/js/dashboard.js");
check("dashboard loads relevance", dash.includes("loadRelevance") && dash.includes('"match-company-events"'));
check("relevance section hidden by default", read("frontend/index.html").includes('id="company-relevance" hidden'));
check("dashboard escapes explanations", dash.includes("escapeHtml(it.explanation)"));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
