// PRISM V2.1 Phase 5 — company intelligence refinement smoke test.
// Run: node --experimental-strip-types projects/prism/test/company-intelligence-smoke.mjs
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
const pz = await import(pathToFileURL(path.join(ROOT, "frontend", "js", "personalize.js")).href);

const P = { industries: [{ industry: "construction", origin: "user_supplied" }], commodities: [{ commodity_slug: "steel", origin: "user_supplied" }], countries: [{ country_code: "CN", role: "supplier", origin: "user_supplied" }], dependencies: [] };
const E = (o = {}) => ({ event_type: "tariffs", commodity_slugs: [], country_codes: [], industries: [], chokepoints: [], ...o });

console.log("[1] purchasing framework (deterministic)");
const direct = rel.matchProfileToEvent(P, E({ commodity_slugs: ["steel"], country_codes: ["CN"] }));
check("disruption type mapped", direct.purchasing.disruption_type === "trade_restriction");
check("dimensions listed", direct.purchasing.dimensions.includes("commodity_exposure") && direct.purchasing.dimensions.includes("geographic_exposure"));
check("tariff implications", direct.purchasing.potential_business_implications.includes("Possible commodity price pressure"));
const logi = rel.matchProfileToEvent(P, E({ event_type: "shipping_disruptions", commodity_slugs: ["steel"], country_codes: ["CN"] }));
check("logistics implications", logi.purchasing.potential_business_implications.includes("Increased transportation costs"));
const inferred = rel.matchProfileToEvent(P, E({ commodity_slugs: ["steel"] }));
check("inferred states assumption", inferred.assumptions.length >= 1);
check("missing country info surfaced", inferred.missing_information.some((m) => m.includes("country")));
const none = rel.matchProfileToEvent(P, E({ commodity_slugs: ["lng"] }));
check("none: no implications", none.purchasing.potential_business_implications.length === 0);
check("indirect = monitor only", rel.matchProfileToEvent({ ...P, commodities: [], countries: [] }, E({ industries: ["construction"] })).purchasing.potential_business_implications[0].includes("Monitor"));
check("AI cannot raise relevance (pure code path)", !read("supabase/functions/_shared/relevance.ts").includes("ai-provider"));

console.log("[2] refined watchlist suggestions");
const s = pz.suggestWatchlists({ commodities: [{ commodity_slug: "electrical-equipment", origin: "user_supplied" }], countries: [{ country_code: "DE", role: "supplier", origin: "user_supplied" }], industries: [] }, []);
check("related inputs suggested", s.some((x) => x.target === "copper") && s.some((x) => x.target === "aluminium"));
check("disruption categories suggested", s.some((x) => x.kind === "category" && x.target === "sanctions"));
check("still capped + deduped", pz.suggestWatchlists({ commodities: [{ commodity_slug: "construction", origin: "user_supplied" }] }, [{ kind: "commodity", target: "steel" }]).every((x) => x.target !== "steel"));
check("explicit confirmation unchanged", read("frontend/js/watchlists.js").includes(".wl-suggest"));

console.log("[3] alerts: severity, change detection, suppression");
const dj = read("frontend/js/dashboard.js");
check("score-aware seen state", dj.includes("seenScores") && dj.includes("Object.fromEntries"));
check("legacy array state supported", dj.includes("Array.isArray(seenIds)"));
check("RELEVANCE CHANGED chip", dj.includes("RELEVANCE CHANGED"));
check("severity chip for direct", dj.includes("high priority"));
check("duplicate suppression kept", dj.includes("freshAlerts(data.items, [...seenScores.keys()])"));

console.log("[4] summary + honest totals + why-panel");
const cj = read("frontend/js/company.js");
check("company summary rendered", cj.includes("renderCompanySummary") && cj.includes("Intelligence summary"));
check("summary sections", ["Critical commodities", "Countries to monitor", "Emerging disruption patterns"].every((s) => cj.includes(s)));
check("summary escaped", cj.includes("escapeHtml(it.title)"));
const dj2 = read("frontend/js/data.js");
check("true totals queried", dj2.includes('count: "exact", head: true') && dj2.includes("data.totals"));
check("dashboard honest label", dj.includes("showing latest") && dj.includes("data.totals?.articles"));
const ed = read("frontend/js/event-detail.js");
check("why-panel implications labeled potential", ed.includes("Potential business implications (not confirmed impacts)"));
check("why-panel assumptions + missing", ed.includes("Assumptions:") && ed.includes("Missing information:"));
const mc = read("supabase/functions/match-company-events/index.ts");
check("function passes purchasing fields", mc.includes("purchasing: rel.purchasing") && mc.includes("assumptions: rel.assumptions"));
check("event_type fed to matcher", mc.includes("factsFor(ev.id, ev.event_type)"));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
