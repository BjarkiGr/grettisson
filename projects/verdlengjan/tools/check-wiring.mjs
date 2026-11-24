// Static wiring check: every element ID referenced by the game scripts must
// exist in index.html, and every <script src> must point at a real file.
//   node tools/check-wiring.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const js = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js'))
  .map((f) => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n');
const refs = [...js.matchAll(/getElementById\('([^']+)'\)|\$\('([^']+)'\)/g)].map((m) => m[1] || m[2]);
const missing = [...new Set(refs)].filter((r) => !ids.has(r));
console.log('ID refs: ' + new Set(refs).size + ', missing: ' + (missing.length ? missing.join(', ') : 'none'));
const scripts = [...html.matchAll(/src="(src\/[^"]+)"/g)].map((m) => m[1]);
const allExist = scripts.every((f) => fs.existsSync(path.join(ROOT, f)));
console.log('scripts exist: ' + allExist + ' (' + scripts.join(', ') + ')');
process.exit(missing.length || !allExist ? 1 : 0);
