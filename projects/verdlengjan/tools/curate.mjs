// Curation pass for the product bank - re-run after each snapshot.
// Flags funny/wildcard items (the daily "fun" slot) and drops redundant
// near-duplicates so the daily five stays varied. Edit lists as needed.
//   node tools/curate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'products.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

// Substring matches (case-insensitive) that mark a product as a fun wildcard.
const FUN = [
  'helvítis', 'jóladagatal', 'þarahylki', 'vanilludropar', 'avócado',
  'almost illegal', 'xmas speculoos', 'jólaglögg', 'döðlur ferskar',
  'búri', 'hamingjuegg', 'kanill', 'smátómatar', 'rauð vínber',
  'taco', 'grisjur', 'laufte', 'baby pads', 'eyrnapinnar',
];
// Exact names to drop (redundant variants - keep a few of each kind).
const DROP = [
  'Grön Balance bleiur buxna nr. 5,  10-18kg',
  'Grön Balance bleiur buxna xl nr. 6, 16-26kg',
  'Grön Balance bleiur junior nr. 5, 12-25kg',
  'Grön Balance bleiur maxi nr. 4, 7-16kg',
  'Grön Balance bleiur mini nr. 2, 3-6kg',
  'Grön Balance bleiur xl nr. 6, 15-30kg',
  'Grön Balance blautklútar barna lúxus',
  'Matseðill gulróta- og engifersúpa',
  'Matseðill sætkartöflusúpa',
  'Matseðill kjúklingur með kínóa',
  'Matseðill kjúklingur með sæt',
];

let flagged = 0, dropped = 0;
data.products = data.products.filter((p) => {
  if (DROP.some((d) => p.name.toLowerCase().startsWith(d.toLowerCase()))) { dropped++; return false; }
  p.fun = FUN.some((f) => p.name.toLowerCase().includes(f));
  if (p.fun) flagged++;
  return true;
});
fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
const cheap = data.products.filter((p) => p.price < 200).length;
const mid = data.products.filter((p) => p.price >= 200 && p.price <= 600).length;
const exp = data.products.filter((p) => p.price > 1000).length;
console.log('Curated: ' + data.products.length + ' products, ' + flagged + ' fun, ' + dropped + ' dropped.');
console.log('Buckets: cheap(<200)=' + cheap + ' mid(200-600)=' + mid + ' expensive(>1000)=' + exp);
