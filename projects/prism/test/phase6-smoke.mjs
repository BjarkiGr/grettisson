// PRISM — Phase 6 smoke test. Zero dependencies.
// Run: node projects/prism/test/phase6-smoke.mjs
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JS = path.join(ROOT, "frontend", "js");
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  ok  " + name); }
  else { fail++; console.error("FAIL  " + name + (detail ? " — " + detail : "")); }
}
const imp = (f) => import(pathToFileURL(path.join(JS, f)).href);
const read = (p) => readFileSync(p, "utf8").replace(/^\uFEFF/, "");

const data = await imp("data.js");
const utils = await imp("utils.js");

console.log("[1] live composition");
const fixture = {
  events: [
    { id: "e1", title: "Ev1", category: "sanctions", primary_country: "RU", region: "Europe", status: "active", first_detected_at: "2026-11-01T00:00:00Z", last_updated_at: "2026-11-20T00:00:00Z", summary: "S1" },
    { id: "e2", title: "Ev2", category: "shipping_disruptions", primary_country: "EG", region: "Middle East", status: "active", first_detected_at: "2026-11-10T00:00:00Z", last_updated_at: "2026-11-21T00:00:00Z", summary: "S2" },
  ],
  riskScores: [
    { event_id: "e1", overall_score: 50, severity_score: 3, probability_score: 3, geographic_score: 2, duration_score: 3, supply_chain_score: 2, economic_score: 2, explanation: "x", confidence: 0.5, created_at: "2026-11-05T00:00:00Z" },
    { event_id: "e1", overall_score: 62, severity_score: 4, probability_score: 4, geographic_score: 3, duration_score: 3, supply_chain_score: 3, economic_score: 3, explanation: "y", confidence: 0.7, created_at: "2026-11-15T00:00:00Z" },
  ],
  analyses: [
    { event_id: "e1", analysis_json: { countries_involved: ["RU", "DE"], commodities_affected: ["natural-gas"], industries_affected: ["energy"], organizations: ["O"], supply_chain_implications: "imp", economic_consequences: "eco", escalation_scenarios: [], uncertainties: [], executive_summary: "sum", supporting_evidence: [] }, confidence: 0.7, provider: "groq", model: "m", prompt_version: "1.0.0", created_at: "2026-11-14T00:00:00Z" },
  ],
  articles: [
    { id: "a1", source_id: "s1", title: "Art1", url: "https://example.com/1", published_at: "2026-11-12T00:00:00Z", collected_at: "2026-11-12T01:00:00Z", content: "c", processing_status: "classified" },
    { id: "a2", source_id: "s1", title: "Art2", url: "https://example.com/2", published_at: "2026-11-13T00:00:00Z", collected_at: "2026-11-13T01:00:00Z", content: "c", processing_status: "irrelevant" },
  ],
  eventArticles: [{ event_id: "e1", article_id: "a1" }],
  sources: [{ id: "s1", name: "Src", active: true, source_type: "news_rss", last_checked_at: "2026-11-23T00:00:00Z" }],
};
const comp = data.composeIntelligence(fixture);
const e1 = comp.eventById.get("e1");
const e2 = comp.eventById.get("e2");
check("latest score wins", e1.overall_score === 62);
check("history preserved", e1.history.length === 2 && e1.history[0].overall_score === 50);
check("dimensions mapped", e1.dimensions.severity === 4 && e1.dimensions.supply_chain === 3);
check("countries from analysis", e1.countries.join() === "RU,DE");
check("unscored event null", e2.overall_score === null && e2.dimensions === null);
check("article joined", comp.articles[0].source_name === "Src" && comp.articles[0].event_id === "e1" && comp.articles[0].category === "sanctions");
check("unlinked article", comp.articles[1].event_id === null);
check("demo flag false", e1.demo === false && comp.articles[0].demo === false);

console.log("[2] activity + trends");
const now = new Date("2026-11-25T12:00:00Z");
const act = data.weeklyActivity([{ collected_at: "2026-11-24T00:00:00Z" }, { collected_at: "2026-11-04T00:00:00Z" }], [{ first_detected_at: "2026-11-23T00:00:00Z" }], now);
check("8 week labels", act.labels.length === 8);
check("current week counts", act.articles_collected[7] === 1 && act.new_events[7] === 1);
check("older week counts", act.articles_collected[4] === 1);
const trends = data.regionTrends(comp.events, ["Europe"]);
check("trend labels from history", trends.labels.length === 2);
check("trend values", trends.series[0].values.join() === "50,62");

console.log("[3] watchlist matching");
const evts = comp.events;
check("country match", data.matchWatchlist(evts, { kind: "country", target: "ru" }).length === 1);
check("region match", data.matchWatchlist(evts, { kind: "region", target: "Europe" }).length === 1);
check("commodity match", data.matchWatchlist(evts, { kind: "commodity", target: "natural-gas" }).length === 1);
check("industry match", data.matchWatchlist(evts, { kind: "industry", target: "energy" }).length === 1);
check("category match", data.matchWatchlist(evts, { kind: "category", target: "sanctions" }).length === 1);
check("empty target -> none", data.matchWatchlist(evts, { kind: "country", target: "" }).length === 0);
check("unknown kind -> none", data.matchWatchlist(evts, { kind: "bogus", target: "x" }).length === 0);

console.log("[4] related + commodities");
const rel = data.relatedEvents(e1, evts);
check("related excludes self", rel.every((e) => e.id !== "e1"));
const idx = data.commodityIndex(evts);
check("commodity index", idx.length === 1 && idx[0].id === "natural-gas" && idx[0].events.length === 1);

console.log("[5] null-score safety");
check("riskLevelFromScore(null)", utils.riskLevelFromScore(null) === null);
check("riskLevelFromScore(undefined)", utils.riskLevelFromScore(undefined) === null);
check("riskLevelFromScore(0) still MINIMAL", utils.riskLevelFromScore(0) === "MINIMAL");

console.log("[6] wiring + auth gate");
const app = read(path.join(JS, "app.js"));
check("auth gate redirect", app.includes('location.replace("login.html")'));
check("gate exempts login only", app.includes('page !== "login" && !session'));
check("watchlists routed", app.includes('watchlists: "./watchlists.js"'));
check("sign-out redirects", app.includes('if (!s && document.body.dataset.page !== "login")'));
const producers = ["dashboard.js","events.js","event-detail.js","regions.js","commodities.js","intelligence.js","watchlists.js","data.js"];
for (const f of producers) {
  check(f + " no demo-data import", !read(path.join(JS, f)).includes("demo-data"));
}
for (const f of readdirSync(path.join(ROOT, "frontend")).filter((f) => f.endsWith(".html"))) {
  check(f + " no demo banner", !read(path.join(ROOT, "frontend", f)).includes('id="demo-banner"'));
}
check("watchlists root exists", read(path.join(ROOT, "frontend", "watchlists.html")).includes('id="watchlists-root"'));
check("geo.js exists", existsSync(path.join(JS, "geo.js")));
const auth = read(path.join(JS, "auth.js"));
check("login redirects to overview", auth.includes('location.href = "index.html"'));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail === 0 ? 0 : 1;
