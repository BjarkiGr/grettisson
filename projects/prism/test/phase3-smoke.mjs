// PRISM — Phase 3 smoke test. Zero dependencies.
// Run: node --experimental-strip-types projects/prism/test/phase3-smoke.mjs
// (the flag lets Node import the pure TypeScript backend modules directly)
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHARED = path.join(ROOT, "supabase", "functions", "_shared");
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  ok  " + name); }
  else { fail++; console.error("FAIL  " + name + (detail ? " — " + detail : "")); }
}
const imp = (dir, f) => import(pathToFileURL(path.join(dir, f)).href);
const read = (p) => readFileSync(p, "utf8").replace(/^\uFEFF/, "");

const { parseFeed, decodeEntities, stripHtml } = await imp(SHARED, "rss.ts");
const { normalizeUrl, contentHash } = await imp(SHARED, "normalize.ts");
const { classifyArticle, detectLanguage } = await imp(SHARED, "classify.ts");

console.log("[1] RSS 2.0 parsing");
const rss2 = '<rss><channel><title>Feed</title>' +
  '<item><title><![CDATA[Sanctions &amp; trade: <b>update</b>]]></title><link>https://example.com/a?utm_source=rss</link>' +
  '<description><![CDATA[<p>First</p> &quot;story&quot; text]]></description><author>Reporter</author>' +
  '<pubDate>Mon, 23 Nov 2026 06:00:00 GMT</pubDate><guid>guid-1</guid></item>' +
  '<item><title>Second</title><link>https://example.com/b</link><description>Plain</description></item>' +
  '<item><title>No link item</title><description>skipped</description></item>' +
  '</channel></rss>';
const items = parseFeed(rss2);
check("two valid items (missing-link skipped)", items.length === 2);
check("CDATA + entities + HTML stripped title", items[0].title === "Sanctions & trade: update", items[0].title);
check("excerpt stripped", items[0].description === 'First "story" text', items[0].description);
check("author", items[0].author === "Reporter");
check("pubDate -> ISO", items[0].publishedAt === "2026-11-23T06:00:00.000Z", items[0].publishedAt);
check("guid", items[0].guid === "guid-1");

console.log("[2] RSS 1.0 (RDF) + Atom parsing");
const rdf = '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><channel><title>c</title></channel>' +
  '<item rdf:about="https://example.com/rdf1"><title>RDF item</title><link>https://example.com/rdf1</link>' +
  '<dc:date>2026-11-20T10:00:00Z</dc:date><description>RDF desc</description></item></rdf:RDF>';
const rdfItems = parseFeed(rdf);
check("RDF item parsed", rdfItems.length === 1 && rdfItems[0].title === "RDF item");
check("dc:date parsed", rdfItems[0].publishedAt === "2026-11-20T10:00:00.000Z");
const atom = '<feed xmlns="http://www.w3.org/2005/Atom">' +
  '<entry><title>Atom entry</title><link rel="self" href="https://example.com/self"/>' +
  '<link rel="alternate" href="https://example.com/atom1"/><author><name>Writer</name></author>' +
  '<published>2026-11-21T08:00:00Z</published><summary>Summary text</summary><id>urn:1</id></entry></feed>';
const atomItems = parseFeed(atom);
check("Atom alternate link preferred", atomItems.length === 1 && atomItems[0].link === "https://example.com/atom1");
check("Atom author name", atomItems[0].author === "Writer");
check("Atom published", atomItems[0].publishedAt === "2026-11-21T08:00:00.000Z");
check("garbage -> empty", parseFeed("not xml at all").length === 0);
check("empty -> empty", parseFeed("").length === 0);

console.log("[3] URL normalization + hashing");
check("tracking/fragment/host/port/slash", normalizeUrl("HTTPS://Example.COM:443/path/?utm_source=x&id=5#frag") === "https://example.com/path?id=5", normalizeUrl("HTTPS://Example.COM:443/path/?utm_source=x&id=5#frag"));
check("param sort", normalizeUrl("https://example.com/p?b=2&a=1") === "https://example.com/p?a=1&b=2");
check("trailing slash", normalizeUrl("https://example.com/p/") === "https://example.com/p");
check("invalid -> null", normalizeUrl("not a url") === null);
check("javascript: -> null", normalizeUrl("javascript:alert(1)") === null);
const h1 = await contentHash("Some Title", "https://example.com/x");
const h2 = await contentHash("some title  ", "https://example.com/x");
const h3 = await contentHash("Some Title", "https://example.com/y");
check("hash is 64 hex", /^[0-9a-f]{64}$/.test(h1));
check("hash stable across case/whitespace", h1 === h2);
check("hash differs by url", h1 !== h3);

console.log("[4] rule-based classification");
const cases = [
  ["Missile strike hits port in Ukraine", "", "military_conflict", "UA", "Europe"],
  ["New sanctions target Russian oil exports", "", "sanctions", "RU", "Europe"],
  ["Typhoon closes Japanese ports", "", "natural_disasters", "JP", "East Asia"],
  ["Central bank warns of inflation and recession", "", "economic_instability", null, null],
  ["Ransomware attack disrupts Singapore terminal", "", "cybersecurity_incidents", "SG", "Southeast Asia"],
  ["Peace summit opens in Switzerland", "", "diplomatic_developments", "CH", "Europe"],
  ["Pipeline outage cuts gas supply to Germany", "", "energy_disruptions", "DE", "Europe"],
  ["Tariff increase on Chinese imports", "", "tariffs", "CN", "East Asia"],
  ["Export ban on wheat announced by India", "", "trade_restrictions", "IN", "South Asia"],
  ["Protests erupt after election in Kenya", "", "political_instability", "KE", "Africa"],
];
for (const [title, content, cat, country, region] of cases) {
  const r = classifyArticle(title, content);
  check("classify: " + title.slice(0, 40), r.relevant && r.category === cat && r.primaryCountry === country && r.region === region, JSON.stringify({ cat: r.category, country: r.primaryCountry, region: r.region }));
}
const irr = classifyArticle("Celebrity wedding photos released", "A famous actor married in a private ceremony.");
check("irrelevant content rejected", irr.relevant === false && irr.category === null);
const bodyHit = classifyArticle("Weekly digest", "The government announced new sanctions today.");
check("content-only hit works", bodyHit.relevant === true && bodyHit.category === "sanctions");

console.log("[4b] Icelandic classification + language detection");
const isCases = [
  ["Jarðskjálfti á Reykjanesi", "natural_disasters", "IS"],
  ["Jarðskjálfta mældist á Suðurlandi", "natural_disasters", null],
  ["Verkfall hjá flugvirkjum", "political_instability", null],
  ["Verðbólga eykst á Íslandi", "economic_instability", "IS"],
  ["Eldgos hófst á Reykjanesskaga", "natural_disasters", null],
  ["Nýr samningur undirritaður í Reykjavík", "diplomatic_developments", "IS"],
];
for (const [title, cat, country] of isCases) {
  const r = classifyArticle(title, "");
  check("IS classify: " + title.slice(0, 32), r.relevant && r.category === cat && (country === null || r.primaryCountry === country), JSON.stringify({ cat: r.category, country: r.primaryCountry }));
}
check("detectLanguage is", detectLanguage("Jarðskjálfti", "þetta er prófun") === "is");
check("detectLanguage en", detectLanguage("Hello world", "plain english text") === "en");
check("English rules unaffected", classifyArticle("New sanctions target Russian oil exports", "").category === "sanctions");
console.log("[4c] classifier bug-fix regressions (real-feed findings)");
const fixCases = [
  ["Africa Cup title given back to Senegal after sports court rules against Morocco", "Fans protest the decision.", false, null],
  ["Trump boðar nýja tolla", "Bandaríkjaforseti boðar nýja tolla á innflutning.", true, "tariffs"],
  ["Nýir tollar á bandarískan innflutning", "", true, "tariffs"],
  ["Trump impersonator mocks president at Canada press dinner", "A comedy performance.", false, null],
  ["US court convicts Huawei of theft: A history of Chinese firm's global woes", "The case spans years of legal battles.", false, null],
  ["War in Ukraine enters fourth year", "", true, "military_conflict"],
  ["Import duties rise on steel", "", true, "tariffs"],
  ["Liði vikunnar í enska boltanum tilkynntur", "", false, null],
  ["Kosningar til Alþingis fara fram í vor", "", true, "political_instability"],
];
for (const [title, content, rel, cat] of fixCases) {
  const r = classifyArticle(title, content);
  check("fix: " + title.slice(0, 42), r.relevant === rel && (cat === null || r.category === cat), JSON.stringify({ rel: r.relevant, cat: r.category }));
}

console.log("[5] function structure");
const FN = path.join(ROOT, "supabase", "functions");
const ing = read(path.join(FN, "ingest-sources", "index.ts"));
const proc = read(path.join(FN, "process-articles", "index.ts"));
check("ingest batch limits", ing.includes("MAX_SOURCES = 8") && ing.includes("MAX_ITEMS_PER_FEED = 25"));
check("ingest fetch timeout", ing.includes("FETCH_TIMEOUT_MS") && ing.includes("AbortController"));
check("ingest dedup upsert", ing.includes('onConflict: "content_hash"') && ing.includes("ignoreDuplicates: true"));
check("ingest queues jobs", ing.includes('job_type: "process_article"'));
check("ingest tolerates duplicate jobs", ing.includes('"23505"'));
check("process atomic claim", proc.includes('.eq("status", "pending")') && proc.includes('status: "running"'));
check("process bounded retries", proc.includes("MAX_ATTEMPTS = 3"));
check("process queues analysis", proc.includes('job_type: "analyze_event"'));
check("process provisional labeling", proc.includes("PROVISIONAL"));
check("seed migration exists", existsSync(path.join(ROOT, "supabase", "migrations", "20261125000000_seed_sources.sql")));
const seed = read(path.join(ROOT, "supabase", "migrations", "20261125000000_seed_sources.sql"));
check("seed idempotent", seed.includes("on conflict (url) do nothing"));
check("seed has 6 sources", (seed.match(/news_rss|government/g) ?? []).length === 6);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail === 0 ? 0 : 1;
