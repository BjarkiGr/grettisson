// PRISM — Supply Chain Map smoke test. Zero dependencies.
// Run: node projects/prism/test/supply-chain-smoke.mjs
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
const read = (p) => readFileSync(p, "utf8").replace(/^\uFEFF/, "");
const routes = await import(pathToFileURL(path.join(JS, "routes.js")).href);

console.log("[1] reference route integrity");
check("16 corridors", routes.CORRIDORS.length === 16);
for (const c of routes.CORRIDORS) {
  check(c.id + " structure", /^[A-Z]{2}$/.test(c.from) && /^[A-Z]{2}$/.test(c.to) && c.countries.includes(c.from) && c.countries.includes(c.to) && ["sea", "air", "pipeline"].includes(c.mode));
  check(c.id + " waypoints valid", c.waypoints.length >= 2 && c.waypoints.every(([la, ln]) => Number.isFinite(la) && Number.isFinite(ln) && la >= -90 && la <= 90 && ln >= -180 && ln <= 180));
  check(c.id + " chokepoints resolve", c.chokepoints.every((k) => routes.CHOKEPOINTS[k]));
}
check("iceland corridors exist", routes.CORRIDORS.filter((c) => c.from === "IS" || c.to === "IS").length >= 2);
check("country names cover endpoints", routes.CORRIDORS.every((c) => routes.COUNTRY_NAMES[c.from] && routes.COUNTRY_NAMES[c.to]));

console.log("[2] destination + disruption logic (pure)");
check("all destinations", routes.corridorsForDestination("").length === 16);
const nl = routes.corridorsForDestination("NL");
check("NL inbound corridors", nl.length === 5 && nl.every((c) => c.to === "NL"));
check("IS inbound corridors", routes.corridorsForDestination("IS").length === 2 && routes.corridorsForDestination("IS").every((c) => c.to === "IS"));
const events = [
  { id: "e1", countries: ["EG", "YE"], overall_score: 80 },
  { id: "e2", countries: ["IS"], overall_score: 40 },
  { id: "e3", countries: ["BR"], overall_score: null },
  { id: "e4", primary_country: "DE", countries: [], overall_score: 55 },
];
const suez = routes.CORRIDORS.find((c) => c.id === "asia-europe-suez");
const ice = routes.CORRIDORS.find((c) => c.id === "iceland-europe");
const pipe = routes.CORRIDORS.find((c) => c.id === "norway-gas");
check("suez disruptions via chokepoint countries", routes.disruptionsForCorridor(suez, events).map((e) => e.id).join() === "e1");
check("iceland corridor disruption", routes.disruptionsForCorridor(ice, events).map((e) => e.id).join() === "e2");
check("primary_country fallback", routes.disruptionsForCorridor(pipe, events).map((e) => e.id).join() === "e4");
check("corridor risk max", routes.corridorRisk(suez, events).max === 80);
check("unscored event -> null risk but listed", routes.corridorRisk(routes.CORRIDORS.find((c) => c.id === "brazil-china-bulk"), events).max === null);
check("no signals -> null", routes.corridorRisk(routes.CORRIDORS.find((c) => c.id === "transpacific"), events).max === null);
check("destination list sorted unique", JSON.stringify(routes.destinationCountries()) === JSON.stringify([...new Set(routes.CORRIDORS.map((c) => c.to))].sort()));

console.log("[3] page wiring");
const page = read(path.join(ROOT, "frontend", "supply-chains.html"));
check("page data-page", page.includes('data-page="supply-chains"'));
check("page containers", page.includes('id="supply-map"') && page.includes('id="corridor-panel"') && page.includes('id="supply-controls"'));
check("reference disclaimer", page.includes("Illustrative reference corridors"));
const app = read(path.join(JS, "app.js"));
check("routed", app.includes('"supply-chains": "./supply-chains.js"'));
const sc = read(path.join(JS, "supply-chains.js"));
check("animated flow class", sc.includes('className: isActive ? "flow-line"'));
check("destination selector", sc.includes('id="dest-select"'));
check("iceland preselect", sc.includes('getStoredRegion() === "iceland"'));
check("escapeHtml in popups", sc.includes("escapeHtml(c.name)") && sc.includes("escapeHtml(cp.name)"));
check("offline fallback", sc.includes("Map unavailable"));
const css = read(path.join(ROOT, "frontend", "css", "components.css"));
check("flow animation css", css.includes("@keyframes flow-dash") && css.includes(".flow-line"));
check("reduced motion respected", css.includes("prefers-reduced-motion"));
for (const f of readdirSync(path.join(ROOT, "frontend")).filter((f) => f.endsWith(".html"))) {
  const html = read(path.join(ROOT, "frontend", f));
  check(f + " nav points to page", html.includes('href="supply-chains.html"') && !html.includes('href="index.html#supply-chains"'));
}
check("overview links to map", read(path.join(JS, "dashboard.js")).includes('href="supply-chains.html"'));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail === 0 ? 0 : 1;
