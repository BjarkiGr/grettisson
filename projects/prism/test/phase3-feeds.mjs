// PRISM — Phase 3 live feed check. Zero dependencies.
// Run: node --experimental-strip-types projects/prism/test/phase3-feeds.mjs
// Fetches every seeded source feed and parses it with the real parser.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { parseFeed } = await import(pathToFileURL(path.join(ROOT, "supabase", "functions", "_shared", "rss.ts")).href);
const { normalizeUrl } = await import(pathToFileURL(path.join(ROOT, "supabase", "functions", "_shared", "normalize.ts")).href);

const seed = readFileSync(path.join(ROOT, "supabase", "migrations", "20261125000000_seed_sources.sql"), "utf8");
const feeds = [...seed.matchAll(/'(https:\/\/[^']+rss[^']*|https:\/\/[^']*feed[^']*|https:\/\/rss\.[^']+)'/g)].map((m) => m[1]);
let pass = 0, fail = 0;
for (const url of feeds) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { headers: { "User-Agent": "PRISM/1.0 (research; +https://github.com/BjarkiGr/grettisson)" }, signal: controller.signal });
    clearTimeout(timer);
    const xml = await res.text();
    const items = parseFeed(xml);
    const validLinks = items.filter((i) => normalizeUrl(i.link) !== null).length;
    const ok = res.status === 200 && items.length > 0 && validLinks === items.length;
    if (ok) { pass++; console.log("  ok  " + url + " — HTTP " + res.status + ", " + items.length + " items, all links normalizable"); }
    else { fail++; console.error("FAIL  " + url + " — HTTP " + res.status + ", " + items.length + " items, " + validLinks + " valid links"); }
    if (items.length > 0) console.log("        sample: " + items[0].title.slice(0, 90));
  } catch (e) {
    fail++;
    console.error("FAIL  " + url + " — " + e.message);
  }
}
console.log("\n" + pass + " passed, " + fail + " failed (" + feeds.length + " feeds)");
process.exitCode = fail === 0 ? 0 : 1;
