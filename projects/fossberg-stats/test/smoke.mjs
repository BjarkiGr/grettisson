// Smoke test for the static Size It Up leaderboard.
// Run: node projects/fossberg-stats/test/smoke.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const js = readFileSync(path.join(dir, 'script.js'), 'utf8');
const html = readFileSync(path.join(dir, 'index.html'), 'utf8');

let failures = 0;
function check(name, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failures++;
}

// 1. Syntax check script.js (parse only, nothing is executed).
try {
  new Function(js);
  check('script.js syntax', true);
} catch (e) {
  check(`script.js syntax (${e.message})`, false);
}

// 2. Every inline handler in index.html must be defined in script.js.
const handlers = [...new Set(
  [...html.matchAll(/on(?:click|input|change)="([A-Za-z_$][\w$]*)\(/g)].map(m => m[1])
)];
for (const h of handlers) {
  check(`handler ${h}() defined`, js.includes(`function ${h}(`));
}

// 3. Every getElementById id used in script.js must exist in index.html.
const ids = [...new Set([...js.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]))];
for (const id of ids) {
  check(`#${id} in index.html`, html.includes(`id="${id}"`));
}

// 4. parseShareText against a real Share text.
const start = js.indexOf('function parseShareText');
const end = js.indexOf('function openSubmitModal');
const parseShareText = new Function(js.slice(start, end) + '\nreturn parseShareText;')();

const sample = [
  'Size It Up',
  '#103',
  '',
  'Score: 314/500',
  '',
  '⬜⬜⬜⬜⬜ 9',
  '🟥🟥🟥🟥⬜ 83',
  '🟩🟩🟩⬜⬜ 122',
  '🟨🟨⬜⬜⬜ 100'
].join('\n');

const parsed = parseShareText(sample);
check('parses puzzle number', parsed !== null && parsed.puzzle === 103);
check('parses score', parsed !== null && parsed.score === 314);
check('parses rounds', parsed !== null && JSON.stringify(parsed.rounds) === JSON.stringify([9, 83, 122, 100]));
check('parses grid (4 round lines)', parsed !== null && parsed.grid.split('\n').length === 4);
check('rejects invalid text', parseShareText('hello world') === null);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
