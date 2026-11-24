// PRISM — Phase 8 smoke test. Zero dependencies.
// Run: node projects/prism/test/phase8-smoke.mjs
import { readFileSync, existsSync } from "node:fs";
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
const data = await import(pathToFileURL(path.join(JS, "data.js")).href);

console.log("[1] region filtering (pure)");
const fixture = {
  events: [
    { id: "eIS", primary_country: "IS", countries: ["IS"], region: "Europe" },
    { id: "eEU", primary_country: "DE", countries: ["DE", "FR"], region: "Europe" },
    { id: "eGL", primary_country: "US", countries: ["US", "IS"], region: "Global" },
  ],
  articles: [
    { id: "a1", event_id: "eEU", source_id: "sGB" },
    { id: "a2", event_id: null, source_id: "sIS" },
    { id: "a3", event_id: "eIS", source_id: "sIS" },
    { id: "a4", event_id: null, source_id: "sGB" },
  ],
  sources: [{ id: "sIS", country: "IS" }, { id: "sGB", country: "GB" }],
  eventById: new Map(),
};
const g = data.applyRegion(fixture, "global");
check("global unchanged", g === fixture);
const ic = data.applyRegion(fixture, "iceland");
check("iceland events: IS-involved only", ic.events.map((e) => e.id).join() === "eIS,eGL");
check("iceland articles: linked or IS-source", ic.articles.map((a) => a.id).join() === "a2,a3");
check("iceland eventById rebuilt", ic.eventById.size === 2 && ic.eventById.has("eIS") && !ic.eventById.has("eEU"));
check("default region global", data.getStoredRegion() === "global");

console.log("[2] selector wiring");
const app = read(path.join(JS, "app.js"));
check("selector injected", app.includes("initRegionSelector") && app.includes('id="region-selector"'));
check("region persisted", app.includes('localStorage.setItem("prism-region"'));
check("options global+iceland", app.includes('value="global"') && app.includes('value="iceland"'));
const det = read(path.join(JS, "event-detail.js"));
check("detail loads unfiltered", det.includes('loadIntelligence("global")'));
check("selector css", read(path.join(ROOT, "frontend", "css", "components.css")).includes(".region-selector"));

console.log("[3] deployment artifacts");
const ry = read(path.join(ROOT, "render.yaml"));
check("render blueprint static", ry.includes("env: static"));
check("render rootDir", ry.includes("rootDir: projects/prism/frontend"));
check("no build step", ry.includes("no build step"));
check("review brief exists", existsSync(path.join(ROOT, "docs", "REVIEW-BRIEF.md")));
const dep = read(path.join(ROOT, "docs", "DEPLOYMENT.md"));
check("backup + recovery documented", dep.includes("Backup and recovery") && dep.includes("pg_dump"));
check("render steps documented", dep.includes("Blueprint") || dep.includes("Static Site"));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail === 0 ? 0 : 1;
