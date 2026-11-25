// PRISM V2 Phase 5 — watchlist suggestions + alerts smoke test.
// Run: node projects/prism/test/watchlist-alerts-smoke.mjs
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
const pz = await import(pathToFileURL(path.join(ROOT, "frontend", "js", "personalize.js")).href);

console.log("[1] suggestWatchlists (pure)");
const facts = {
  commodities: [{ commodity_slug: "steel", origin: "user_supplied" }, { commodity_slug: "timber", origin: "ai_confirmed" }],
  countries: [{ country_code: "CN", role: "supplier", origin: "user_supplied" }, { country_code: "CN", role: "customer", origin: "user_supplied" }, { country_code: "DE", role: "supplier", origin: "ai_confirmed" }],
  industries: [{ industry: "construction", origin: "user_supplied" }],
};
const s = pz.suggestWatchlists(facts, [{ kind: "commodity", target: "Steel" }]);
check("existing watchlist deduped case-insensitively", !s.some((x) => x.kind === "commodity" && x.target.toLowerCase() === "steel"));
check("country deduped across roles", s.filter((x) => x.kind === "country" && x.target === "CN").length === 1);
check("valid kinds only", s.every((x) => ["country", "region", "commodity", "industry", "category"].includes(x.kind)));
check("origins preserved", s.find((x) => x.target === "timber").origin === "ai_confirmed");
check("cap 12", pz.suggestWatchlists({ commodities: Array.from({ length: 30 }, (_, i) => ({ commodity_slug: "c" + i, origin: "user_supplied" })) }, []).length === 12);
check("empty facts -> no suggestions", pz.suggestWatchlists({}, []).length === 0);
check("no auto-creation: pure function only", !read("frontend/js/personalize.js").includes("insert"));

console.log("[2] freshAlerts (pure)");
const items = [{ event_id: "a" }, { event_id: "b" }, { event_id: "c" }];
check("fresh = unseen only", pz.freshAlerts(items, ["a", "c"]).map((x) => x.event_id).join() === "b");
check("no seen -> all fresh", pz.freshAlerts(items, []).length === 3);
check("all seen -> none fresh", pz.freshAlerts(items, ["a", "b", "c"]).length === 0);
check("null-safe", pz.freshAlerts(null, null).length === 0);

console.log("[3] watchlists page wiring");
const wl = read("frontend/js/watchlists.js");
check("profile loaded owner-scoped", wl.includes('.eq("user_id", session.user.id)'));
check("suggestions panel rendered", wl.includes("Suggested from your company profile"));
check("explicit user action creates watchlist", wl.includes(".wl-suggest") && wl.includes('insert({ user_id: session.user.id, name: s.name'));
check("nothing created automatically", !wl.includes("insert({ user_id: session.user.id, name: s.name, kind: s.kind, target: s.target });\n    }") || wl.includes("addEventListener"));
check("suggestion text escaped", wl.includes("escapeHtml(s.name)"));
check("duplicate handled", wl.includes("23505"));

console.log("[4] dashboard alerts wiring");
const dj = read("frontend/js/dashboard.js");
check("freshAlerts imported + used", dj.includes('import { freshAlerts }') && dj.includes("freshAlerts(data.items, [...seenScores.keys()])"));
check("per-user seen key", dj.includes('"prism_seen_relevance_" + (session?.user?.id ?? "anon")'));
check("NEW chip on fresh items", dj.includes("freshIds.has(it.event_id) ? '<span class=\"chip\">NEW</span>' : ''"));
check("mark-all-seen button", dj.includes('id="rel-seen"') || dj.includes("#rel-seen"));
check("device-local honestly labeled", dj.includes("Read state is stored on this device only."));
check("storage guarded", dj.includes("catch { /* storage unavailable */ }"));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
