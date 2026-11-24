// PRISM — foundation smoke test (Phase 0). Zero dependencies.
// Run: node projects/prism/test/foundation-smoke.mjs
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FRONTEND = path.join(ROOT, "frontend");
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  ok  " + name); }
  else { fail++; console.error("FAIL  " + name + (detail ? " — " + detail : "")); }
}
const read = (p) => readFileSync(p, "utf8").replace(/^\uFEFF/, "");

console.log("[1] expected files exist");
const expected = [
  "README.md", ".gitignore", ".env.example",
  "frontend/index.html", "frontend/login.html", "frontend/events.html",
  "frontend/event-detail.html", "frontend/regions.html", "frontend/commodities.html",
  "frontend/watchlists.html", "frontend/settings.html",
  "frontend/css/main.css", "frontend/css/layout.css", "frontend/css/components.css",
  "frontend/css/dashboard.css", "frontend/css/responsive.css",
  "frontend/js/config.js", "frontend/js/app.js", "frontend/js/auth.js",
  "frontend/js/supabase.js", "frontend/js/navigation.js", "frontend/js/dashboard.js",
  "frontend/js/intelligence.js", "frontend/js/events.js", "frontend/js/event-detail.js",
  "frontend/js/regions.js", "frontend/js/commodities.js", "frontend/js/watchlists.js",
  "frontend/js/charts.js", "frontend/js/map.js", "frontend/js/utils.js",
  "supabase/config.toml", "supabase/functions/.env.example",
  "supabase/functions/_shared/cors.ts", "supabase/functions/_shared/database.ts",
  "supabase/functions/_shared/ai-provider.ts", "supabase/functions/_shared/validation.ts",
  "supabase/functions/_shared/types.ts",
  "supabase/functions/ingest-sources/index.ts", "supabase/functions/process-articles/index.ts",
  "supabase/functions/analyze-events/index.ts", "supabase/functions/calculate-risk/index.ts",
  "supabase/functions/health-check/index.ts",
  "docs/ARCHITECTURE.md", "docs/DATABASE.md", "docs/AI-INTEGRATION.md",
  "docs/RISK-METHODOLOGY.md", "docs/DEPLOYMENT.md", "docs/CHANGELOG.md",
];
for (const f of expected) check(f, existsSync(path.join(ROOT, f)));

console.log("[2] HTML local references resolve");
for (const f of expected.filter((f) => f.endsWith(".html"))) {
  const html = read(path.join(ROOT, f));
  const refs = [...html.matchAll(/(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)].map((m) => m[1]);
  for (const r of refs) {
    if (/^(https?:|mailto:)/.test(r)) continue;
    check(f + " -> " + r, existsSync(path.join(FRONTEND, r)));
  }
}

console.log("[3] frontend JS parses as ES modules");
const jsDir = path.join(FRONTEND, "js");
for (const f of readdirSync(jsDir).filter((f) => f.endsWith(".js"))) {
  const res = spawnSync(process.execPath, ["--input-type=module", "--check"], {
    input: read(path.join(jsDir, f)), encoding: "utf8",
  });
  check("syntax js/" + f, res.status === 0, (res.stderr || "").trim().split("\n")[0]);
}

console.log("[4] Edge Function TS syntax (Node type-stripping; skipped if unsupported)");
const fnDir = path.join(ROOT, "supabase", "functions");
const tsFiles = [];
for (const d of readdirSync(fnDir, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  for (const f of readdirSync(path.join(fnDir, d.name))) {
    if (f.endsWith(".ts")) tsFiles.push(path.join(fnDir, d.name, f));
  }
}
let tsSupported = true;
for (const f of tsFiles) {
  if (!tsSupported) break;
  const res = spawnSync(process.execPath, ["--experimental-strip-types", "--check", f], { encoding: "utf8" });
  const err = (res.stderr || "").trim();
  if (/bad option|not allowed|Unknown|ERR_UNKNOWN/.test(err) && res.status !== 0) {
    tsSupported = false;
    console.log("skip  TS syntax check unsupported by this Node build: " + err.split("\n")[0]);
    break;
  }
  check("syntax " + path.relative(ROOT, f), res.status === 0, err.split("\n")[0]);
}

console.log("[5] unit checks: utils + config");
const utils = await import(pathToFileURL(path.join(jsDir, "utils.js")).href);
const cfg = await import(pathToFileURL(path.join(jsDir, "config.js")).href);
check("escapeHtml neutralizes tags/quotes",
  utils.escapeHtml('<img src=x onerror="alert(1)">&\'') ===
  "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;");
check("escapeHtml handles null", utils.escapeHtml(null) === "");
check("formatDateTime valid", utils.formatDateTime("2026-01-02T03:04:05Z") === "2026-01-02 03:04 UTC");
check("formatDateTime invalid", utils.formatDateTime("not-a-date") === "\u2014");
const bands = [[0,"MINIMAL"],[19,"MINIMAL"],[20,"LOW"],[39,"LOW"],[40,"MODERATE"],[59,"MODERATE"],[60,"HIGH"],[79,"HIGH"],[80,"CRITICAL"],[100,"CRITICAL"]];
for (const [score, level] of bands) check("risk band " + score + " -> " + level, utils.riskLevelFromScore(score) === level);
for (const bad of [-1, 101, NaN, "x"]) check("risk band rejects " + String(bad), utils.riskLevelFromScore(bad) === null);
check("config valid", cfg.isConfigured() === false || /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(cfg.config.supabaseUrl));

console.log("[6] no backend secrets referenced in frontend");
for (const f of readdirSync(jsDir).filter((f) => f.endsWith(".js"))) {
  const src = read(path.join(jsDir, f));
  check("no secrets in js/" + f, !/SUPABASE_SERVICE_ROLE_KEY|AI_API_KEY/.test(src));
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail === 0 ? 0 : 1;
