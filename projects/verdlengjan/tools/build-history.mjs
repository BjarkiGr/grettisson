// Builds data/price-history.json from all archived banks + the current one.
// Format: { generated, history: { sku: [[date, price], ...] } } - compact on
// purpose, it ships to the browser for the reveal-phase price-history row.
// Run after each refresh (the workflow does this automatically):
//   node tools/build-history.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const byDate = new Map(); // snapshotDate -> products (current bank wins ties)
const banksDir = path.join(DATA, 'banks');
if (fs.existsSync(banksDir)) {
  for (const f of fs.readdirSync(banksDir).filter((f) => /^products-\d{4}-\d{2}-\d{2}\.json$/.test(f))) {
    const b = JSON.parse(fs.readFileSync(path.join(banksDir, f), 'utf8'));
    if (b.snapshotDate && Array.isArray(b.products)) byDate.set(b.snapshotDate, b.products);
  }
}
const cur = JSON.parse(fs.readFileSync(path.join(DATA, 'products.json'), 'utf8'));
if (cur.snapshotDate && Array.isArray(cur.products)) byDate.set(cur.snapshotDate, cur.products);

const history = {};
for (const date of [...byDate.keys()].sort()) {
  for (const p of byDate.get(date)) {
    if (!p.sku || !Number.isFinite(p.price) || p.price <= 0) continue;
    (history[p.sku] = history[p.sku] || []).push([date, p.price]);
  }
}
const out = { generated: new Date().toISOString().slice(0, 10), history };
fs.writeFileSync(path.join(DATA, 'price-history.json'), JSON.stringify(out) + '\n');
const skus = Object.keys(history).length;
const multi = Object.values(history).filter((pts) => pts.length >= 2).length;
console.log('Price history: ' + skus + ' products from ' + byDate.size + ' snapshot(s), ' + multi + ' with 2+ points.');
