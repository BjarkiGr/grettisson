// PRISM V2 Phase 4 — personalized feed smoke test. Zero dependencies.
// Run: node projects/prism/test/personalization-smoke.mjs
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

console.log("[1] single-event mode in match-company-events");
const fn = read("supabase/functions/match-company-events/index.ts");
check("event_id parsed + UUID-validated", fn.includes("/^[0-9a-f-]{36}$/i.test(body.event_id)"));
check("single mode queries by id", fn.includes('evQuery.eq("id", singleId)'));
check("none exposure kept in single mode", fn.includes('rel.exposure === "none" && !singleId'));
check("single mode returns item", fn.includes("if (singleId) return json({ has_profile: true, item: items[0] ?? null })"));
check("list mode unchanged (top 20)", fn.includes("items.slice(0, MAX_RESULTS)"));

console.log("[2] pure relevance ranking");
const ev = await import(pathToFileURL(path.join(ROOT, "frontend", "js", "events.js")).href);
const events = [{ id: "a", overall_score: 90 }, { id: "b", overall_score: 10 }, { id: "c", overall_score: 50 }, { id: "d", overall_score: 99 }];
const relMap = new Map([["a", { exposure: "inferred", relevance_score: 50 }], ["b", { exposure: "direct", relevance_score: 85 }], ["c", { exposure: "none", relevance_score: 0 }]]);
const ranked = ev.rankByRelevance(events, relMap);
check("only connected events, relevance order", ranked.map((e) => e.id).join() === "b,a");
check("none-exposure excluded", !ranked.some((e) => e.id === "c"));
check("unmatched excluded", !ranked.some((e) => e.id === "d"));
check("empty map -> empty result", ev.rankByRelevance(events, new Map()).length === 0);

console.log("[3] feed wiring");
const ej = read("frontend/js/events.js");
check("company toggle exists (hidden default)", ej.includes('id="events-company"') && ej.includes("hidden>My company: off"));
check("toggle only with profile matches", ej.includes("if (relMap.size)"));
check("company mode uses rankByRelevance", ej.includes("rows = rankByRelevance(rows, relMap)"));
check("company cards escape explanation", ej.includes("escapeHtml(it.explanation)"));
check("region/search filters still applied first", ej.includes("let rows = filterEvents(data.events, filters);"));
check("normal mode intact", ej.includes("rows.map(eventListItem)"));

console.log("[4] event page why-panel");
const ed = read("frontend/js/event-detail.js");
check("initCompanyWhy defined + called", ed.includes("async function initCompanyWhy(event)") && ed.includes("initCompanyWhy(event);"));
check("single-event invoke", ed.includes("body: { event_id: event.id }"));
check("panel only with profile", ed.includes("!data?.has_profile"));
check("honest none state", ed.includes("No connection found between this event and your company profile."));
check("reasons escaped", ed.includes("escapeHtml(m.reason)"));
check("relevance/risk separation stated", ed.includes("Relevance is separate from global risk."));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
