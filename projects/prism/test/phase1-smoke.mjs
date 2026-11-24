// PRISM — Phase 1 smoke test. Zero dependencies.
// Run: node projects/prism/test/phase1-smoke.mjs
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

const data = await imp("demo-data.js");
const utils = await imp("utils.js");
const components = await imp("components.js");
const events = await imp("events.js");
const intel = await imp("intelligence.js");
const regions = await imp("regions.js");

const CATEGORIES = ["military_conflict","political_instability","trade_restrictions","sanctions","tariffs","natural_disasters","energy_disruptions","shipping_disruptions","economic_instability","infrastructure_disruptions","diplomatic_developments","cybersecurity_incidents"];

console.log("[1] demonstration data integrity");
check("IS_DEMO flag", data.IS_DEMO === true);
check("event ids unique", new Set(data.DEMO_EVENTS.map((e) => e.id)).size === data.DEMO_EVENTS.length);
check("article ids unique", new Set(data.DEMO_ARTICLES.map((a) => a.id)).size === data.DEMO_ARTICLES.length);
const commodityIds = new Set(data.DEMO_COMMODITIES.map((c) => c.id));
const eventIds = new Set(data.DEMO_EVENTS.map((e) => e.id));
const sourceIds = new Set(data.DEMO_SOURCES.map((s) => s.id));
for (const e of data.DEMO_EVENTS) {
  check(e.id + " marked demo", e.demo === true && e.title.startsWith("Demo:"));
  check(e.id + " valid category", CATEGORIES.includes(e.category));
  check(e.id + " score computed from dimensions", e.overall_score === utils.computeOverallScore(e.dimensions));
  check(e.id + " score in range with level", e.overall_score >= 0 && e.overall_score <= 100 && utils.riskLevelFromScore(e.overall_score) !== null);
  check(e.id + " dimensions 0-5", Object.values(e.dimensions).every((v) => v >= 0 && v <= 5));
  check(e.id + " related ids resolve", e.related.every((id) => eventIds.has(id)));
  check(e.id + " commodities resolve", e.commodities.every((id) => commodityIds.has(id)));
  check(e.id + " map coords exist", Boolean(data.COUNTRY_COORDS[e.primary_country]));
  check(e.id + " history valid", e.history.every((h) => h.overall_score >= 0 && h.overall_score <= 100));
  check(e.id + " has supporting articles", data.articlesForEvent(e.id).length > 0);
  check(e.id + " analysis marked simulated", e.analysis.provider === "demonstration");
}
for (const a of data.DEMO_ARTICLES) {
  check(a.id + " demo + example.com + refs", a.demo === true && a.url.startsWith("https://example.com/") && sourceIds.has(a.source_id) && (a.event_id === null || eventIds.has(a.event_id)));
}
for (const s of data.DEMO_SOURCES) {
  check(s.id + " fictional source url", s.url.startsWith("https://example.com/"));
}

console.log("[2] transparent score calculation");
check("all-zero dimensions -> 0", utils.computeOverallScore({ severity: 0, probability: 0, geographic: 0, duration: 0, supply_chain: 0, economic: 0 }) === 0);
check("all-five dimensions -> 100", utils.computeOverallScore({ severity: 5, probability: 5, geographic: 5, duration: 5, supply_chain: 5, economic: 5 }) === 100);
check("strait scenario -> 85", utils.computeOverallScore(data.findEvent("demo-evt-001").dimensions) === 85);
check("missing dimension -> null", utils.computeOverallScore({ severity: 5 }) === null);
check("out-of-range dimension -> null", utils.computeOverallScore({ severity: 6, probability: 0, geographic: 0, duration: 0, supply_chain: 0, economic: 0 }) === null);

console.log("[3] event filters (pure)");
const E = data.DEMO_EVENTS;
check("query typhoon", events.filterEvents(E, { query: "typhoon" }).length === 1);
check("category sanctions", events.filterEvents(E, { category: "sanctions" }).length === 1);
check("region Europe", events.filterEvents(E, { region: "Europe" }).length === 3);
check("level CRITICAL", events.filterEvents(E, { level: "CRITICAL" }).map((e) => e.id).join() === "demo-evt-001");
check("combined query+region", events.filterEvents(E, { query: "pipeline", region: "Europe" }).length === 1);
check("no match -> empty", events.filterEvents(E, { query: "zzz-not-present" }).length === 0);

console.log("[4] article filters (pure)");
const A = data.DEMO_ARTICLES;
check("query strait", intel.filterArticles(A, { query: "strait" }, E).length === 3);
check("status pending", intel.filterArticles(A, { status: "pending" }, E).length === 1);
check("category tariffs", intel.filterArticles(A, { category: "tariffs" }, E).length === 2);
check("level CRITICAL links via event", intel.filterArticles(A, { level: "CRITICAL" }, E).length === 3);
check("irrelevant excluded by category filter", intel.filterArticles(A, { category: "sanctions" }, E).every((a) => a.event_id !== null));

console.log("[5] regional aggregation (pure)");
const agg = regions.aggregateByRegion(E);
const europe = agg.find((r) => r.region === "Europe");
check("Europe count 3", europe.count === 3);
check("Europe max 71 HIGH", europe.maxScore === 71 && europe.level === "HIGH");
check("Middle East critical first", agg[0].region === "Middle East" && agg[0].level === "CRITICAL");
check("sorted by max desc", agg.every((r, i) => i === 0 || agg[i - 1].maxScore >= r.maxScore));
check("commodity linkage crude-oil", data.eventsForCommodity("crude-oil").length === 2);

console.log("[6] components escape untrusted content");
const evil = { id: "x", title: "<script>alert(1)</script>", category: "sanctions", region: "<b>R</b>", primary_country: "<i>C</i>", last_updated_at: "2026-11-01T00:00:00Z", overall_score: 50 };
const row = components.eventListItem(evil);
check("event row escapes title", !row.includes("<script>") && row.includes("&lt;script&gt;"));
check("risk badge class", components.riskBadge("CRITICAL").includes("risk-badge critical"));
check("unknown level safe", components.riskBadge("BOGUS").includes("muted"));
check("dimension bar width", components.dimensionBar("Severity", 5).includes("width:100%"));

console.log("[7] page wiring");
const dataPages = { "index.html": "overview", "events.html": "events", "event-detail.html": "event-detail", "regions.html": "regions", "commodities.html": "commodities" };
for (const [file, page] of Object.entries(dataPages)) {
  const html = read(path.join(ROOT, "frontend", file));
  check(file + " data-page", html.includes('data-page="' + page + '"'));
  check(file + " no demo banner (live data)", !html.includes('id="demo-banner"'));
  check(file + " nav toggle", html.includes('id="nav-toggle"'));
}
for (const file of ["login.html", "watchlists.html", "settings.html"]) {
  const html = read(path.join(ROOT, "frontend", file));
  check(file + " no demo banner", !html.includes('id="demo-banner"'));
}
check("watchlists functional (Phase 6)", read(path.join(ROOT, "frontend", "watchlists.html")).includes("watchlists-root"));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail === 0 ? 0 : 1;
