// Snapshot script for Verðlengjan - run locally, never ships to the browser.
// Builds data/products.json from real Krónan prices. Two modes:
//
//   node tools/fetch-products.mjs            (default, no token needed)
//       Scrapes the PUBLIC catalog page /voruurval + front page for product
//       links, then reads schema.org JSON-LD from each /vara/ page.
//       Respects robots.txt (never touches /snjallverslun/*).
//
//   node tools/fetch-products.mjs --api      (needs KRONAN_TOKEN env var)
//       Uses the official public API (api.kronan.is/api/v1). Create a token
//       in your kronan.is settings (Auðkenni login). Rate limit 200 req/200 s
//       is respected with a 1.1 s throttle.
//
// Options: --limit N (cap number of products), --out PATH.
// Prices are pinned to the snapshot date - puzzles stay fair even when
// Krónan changes prices later. Re-run every month or so for a fresh bank.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const API_MODE = args.includes('--api');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 ? args[outIdx + 1] : path.join(ROOT, 'data', 'products.json');
const UA = 'VerdlaengjanSnapshot/1.0 (personal daily game project; grettisson.is)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, opts = {}) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, ...(opts.headers || {}) }, ...opts });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    } catch (e) {
      if (attempt === 2) throw e;
      await sleep(800);
    }
  }
}

// --- Mode B: public JSON-LD scraping -------------------------------------
function productLinks(html) {
  const out = new Set();
  for (const m of html.matchAll(/href="(\/vara\/[^"]+)"/g)) out.add(m[1]);
  return [...out];
}

function parseProduct(html, url) {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let obj;
    try { obj = JSON.parse(m[1]); } catch { continue; }
    const items = Array.isArray(obj) ? obj : [obj];
    const p = items.find((x) => x && x['@type'] === 'Product');
    if (!p || !p.offers) continue;
    const price = Number(p.offers.price);
    if (!p.name || !Number.isFinite(price) || price <= 0) return null;
    // Package size line, e.g. "ca. 160 gr. - 230 kr. / kg" -> "ca. 160 gr."
    const sm = html.match(/>([^<>]*?\d[\d.,]*\s*(?:gr\.?|kg|ml\.?|ltr\.?|stk\.?)[^<>]*?)\s*-\s*\d[\d.]*\s*kr\.\s*\/\s*(?:kg|ltr|stk)/);
    return {
      sku: String(p.sku || ''),
      name: String(p.name).trim(),
      size: sm ? sm[1].trim() : '',
      price,
      category: String(p.category || '').trim(),
      image: Array.isArray(p.image) ? p.image[0] : (p.image || ''),
      url: p.offers.url || ('https://kronan.is' + url),
      fun: false,
    };
  }
  return null;
}

async function scrapeMode() {
  console.log('Collecting product links from /voruurval and front page...');
  const links = new Set();
  for (const page of ['https://kronan.is/voruurval', 'https://kronan.is/']) {
    for (const l of productLinks(await get(page))) links.add(l);
  }
  let urls = [...links];
  if (Number.isFinite(LIMIT)) urls = urls.slice(0, LIMIT);
  console.log('Found ' + urls.length + ' product pages. Fetching (3 at a time)...');
  const products = [];
  let done = 0, failed = 0;
  const queue = [...urls];
  async function worker() {
    while (queue.length) {
      const url = queue.shift();
      try {
        const p = parseProduct(await get('https://kronan.is' + url), url);
        if (p) products.push(p); else failed++;
      } catch (e) {
        failed++;
        console.log('  skip ' + url + ' (' + e.message + ')');
      }
      done++;
      if (done % 20 === 0) console.log('  ' + done + '/' + urls.length + ' (' + products.length + ' ok, ' + failed + ' failed)');
      await sleep(120);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return products;
}

// --- Mode A: official public API (token required) -------------------------
async function apiMode() {
  const token = process.env.KRONAN_TOKEN;
  if (!token) { console.error('--api requires KRONAN_TOKEN env var (kronan.is settings, Auðkenni).'); process.exit(1); }
  const headers = { Authorization: 'AccessToken ' + token };
  const base = 'https://api.kronan.is/api/v1';
  console.log('Fetching category tree...');
  const tree = JSON.parse(await get(base + '/categories/', { headers }));
  const slugs = [];
  (function walk(nodes) {
    for (const n of nodes || []) {
      if (n.slug) slugs.push(n.slug);
      walk(n.children || n.subcategories || []);
    }
  })(Array.isArray(tree) ? tree : tree.results || []);
  console.log(slugs.length + ' categories. Fetching products (1.1 s throttle)...');
  const products = [];
  let loggedSample = false;
  for (const slug of slugs) {
    for (let page = 1; page <= 25; page++) {
      await sleep(1100); // stay under 200 req / 200 s
      let data;
      try { data = JSON.parse(await get(base + '/categories/' + slug + '/products/?page=' + page, { headers })); }
      catch (e) { console.log('  ' + slug + ' page ' + page + ': ' + e.message); break; }
      const rows = Array.isArray(data) ? data : data.results || [];
      if (!rows.length) break;
      for (const p of rows) {
        if (!loggedSample) { console.log('Sample API product: ' + JSON.stringify(p).slice(0, 600)); loggedSample = true; }
        const price = Number(p.price ?? p.unit_price ?? (p.offer && p.offer.price));
        if (!p.name || !Number.isFinite(price) || price <= 0) continue;
        products.push({
          sku: String(p.sku ?? p.id ?? ''),
          name: String(p.name).trim(),
          size: String(p.size ?? p.unit ?? p.package_size ?? '').trim(),
          price,
          category: String((p.category && p.category.name) || p.category || slug).trim(),
          image: p.image || (Array.isArray(p.images) && p.images[0]) || p.thumbnail || '',
          url: p.url || ('https://kronan.is/vara/' + (p.sku ?? p.id)),
          fun: false,
        });
        if (products.length >= LIMIT) break;
      }
      if (products.length >= LIMIT || rows.length < 48) break;
    }
    if (products.length >= LIMIT) break;
  }
  return products;
}

// --- main ------------------------------------------------------------------
const raw = API_MODE ? await apiMode() : await scrapeMode();
const bySku = new Map();
for (const p of raw) {
  const key = p.sku || p.url;
  if (!bySku.has(key)) bySku.set(key, p);
}
const products = [...bySku.values()].sort((a, b) =>
  a.category.localeCompare(b.category, 'is') || a.name.localeCompare(b.name, 'is'));
const snapshot = {
  snapshotDate: new Date().toISOString().slice(0, 10),
  source: API_MODE ? 'kronan-public-api' : 'kronan.is JSON-LD',
  products,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n');
const cheap = products.filter((p) => p.price < 150).length;
const mid = products.filter((p) => p.price >= 150 && p.price <= 600).length;
const exp = products.filter((p) => p.price > 1000).length;
console.log('\nWrote ' + products.length + ' products to ' + OUT);
console.log('Price buckets: cheap(<150)=' + cheap + ' mid(150-600)=' + mid + ' expensive(>1000)=' + exp);
console.log('Next: review the bank, flag funny items with "fun": true, drop junk.');
