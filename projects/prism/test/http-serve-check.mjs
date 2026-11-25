// PRISM — HTTP serve check: serves frontend/ and verifies pages + modules.
// Run: node projects/prism/test/http-serve-check.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "frontend");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const server = createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(ROOT) || !existsSync(p)) { res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(p)] ?? "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port;
let pass = 0, fail = 0;
const check = (name, ok) => { if (ok) { pass++; console.log("  ok  " + name); } else { fail++; console.error("FAIL  " + name); } };
const PAGES = ["index", "login", "events", "event-detail", "regions", "commodities", "supply-chains", "company", "watchlists", "settings"];
for (const pg of PAGES) {
  const res = await fetch(base + "/" + pg + ".html");
  const body = await res.text();
  check(pg + ".html 200 + module + nav", res.status === 200 && body.includes('type="module" src="js/app.js"') && body.includes('href="company.html"'));
}
const MODULES = ["app", "data", "dashboard", "events", "event-detail", "company", "watchlists", "settings", "personalize", "utils", "components", "supabase", "auth", "intelligence", "charts", "regions", "commodities", "supply-chains"];
for (const m of MODULES) {
  const res = await fetch(base + "/js/" + m + ".js");
  check("js/" + m + ".js served as module", res.status === 200 && (res.headers.get("content-type") ?? "").includes("text/javascript"));
}
const css = await fetch(base + "/css/main.css");
check("css served", css.status === 200);
server.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
