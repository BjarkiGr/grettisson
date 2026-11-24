// Archive the current product bank BEFORE a refresh overwrites it.
// Copies data/products.json -> data/banks/products-<snapshotDate>.json and
// upserts data/manifest.json so the game can still serve the right prices
// for dates before the new snapshot (fair daily puzzles, price history).
//   node tools/archive-bank.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const CUR = path.join(DATA, 'products.json');
const cur = JSON.parse(fs.readFileSync(CUR, 'utf8'));
const date = cur.snapshotDate;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
  console.error('products.json has no valid snapshotDate - refusing to archive.');
  process.exit(1);
}

const banksDir = path.join(DATA, 'banks');
fs.mkdirSync(banksDir, { recursive: true });
const file = 'banks/products-' + date + '.json';
fs.copyFileSync(CUR, path.join(DATA, file));

const manPath = path.join(DATA, 'manifest.json');
let man = { banks: [] };
try { man = JSON.parse(fs.readFileSync(manPath, 'utf8')); } catch (e) { /* first run */ }
if (!Array.isArray(man.banks)) man.banks = [];
man.banks = man.banks.filter((b) => b && b.from !== date);
man.banks.push({ file, from: date });
man.banks.sort((a, b) => a.from.localeCompare(b.from));
fs.writeFileSync(manPath, JSON.stringify(man, null, 2) + '\n');
console.log('Archived ' + cur.products.length + ' products (snapshot ' + date + ') -> data/' + file);
console.log('Manifest now lists ' + man.banks.length + ' bank(s).');
