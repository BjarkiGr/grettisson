// Smoke test for the static Daily Games Stats leaderboard (4 games).
// Run: node projects/daily-games-stats/test/smoke.mjs
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

// 3. Every getElementById id used in script.js must exist in index.html
//    (gameTab-* ids are built dynamically, so check their prefixes too).
const ids = [...new Set([...js.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]))];
for (const id of ids) {
  check(`#${id} in index.html`, html.includes(`id="${id}"`));
}
for (const g of ['sizeitup', 'skuggabaldur', 'krillion', 'verdlengjan']) {
  check(`#gameTab-${g} in index.html`, html.includes(`id="gameTab-${g}"`));
}

// 4. Parsers against real Share texts from all three games.
const start = js.indexOf('function parseShareText');
const end = js.indexOf('function openSubmitModal');
const parseShareText = new Function(js.slice(start, end) + '\nreturn parseShareText;')();

const sizeSample = [
  'Size It Up', '#103', '', 'Score: 314/500', '',
  '⬜⬜⬜⬜⬜ 9', '🟥🟥🟥🟥⬜ 83', '🟩🟩🟩⬜⬜ 122', '🟨🟨⬜⬜⬜ 100'
].join('\n');
const p1 = parseShareText(sizeSample);
check('Size It Up: detected', p1 !== null && p1.game === 'sizeitup');
check('Size It Up: puzzle', p1 !== null && p1.puzzle === 103);
check('Size It Up: score', p1 !== null && p1.score === 314);
check('Size It Up: rounds', p1 !== null && JSON.stringify(p1.rounds) === JSON.stringify([9, 83, 122, 100]));
check('Size It Up: grid', p1 !== null && p1.grid.split('\n').length === 4);

const skuggaSample = [
  'Skuggabaldur #37 🌑 380/700',
  '🐻‍❄️🐑🦌🐑🐑🦌🐻‍❄️',
  'https://skuggabaldur.is'
].join('\n');
const p2 = parseShareText(skuggaSample);
check('Skuggabaldur: detected', p2 !== null && p2.game === 'skuggabaldur');
check('Skuggabaldur: puzzle', p2 !== null && p2.puzzle === 37);
check('Skuggabaldur: score', p2 !== null && p2.score === 380);
check('Skuggabaldur: grid', p2 !== null && p2.grid === '🐻‍❄️🐑🦌🐑🐑🦌🐻‍❄️');
check('Skuggabaldur: no URL in grid', p2 !== null && !p2.grid.includes('https'));

const krillionSample = [
  'Krillion #128 🦐', '265', '', '🫧🫧🫧🦑🦑🐟🏮'
].join('\n');
const p3 = parseShareText(krillionSample);
check('Krillion: detected', p3 !== null && p3.game === 'krillion');
check('Krillion: puzzle', p3 !== null && p3.puzzle === 128);
check('Krillion: score', p3 !== null && p3.score === 265);
check('Krillion: grid', p3 !== null && p3.grid === '🫧🫧🫧🦑🦑🐟🏮');

const verdSample = [
  '🥐 Verðlengjan #3 — 74 cm',
  '🎯🟩🟨🟧🟥',
  'grettisson.is/projects/verdlengjan/'
].join('\n');
const p4 = parseShareText(verdSample);
check('Verðlengjan: detected', p4 !== null && p4.game === 'verdlengjan');
check('Verðlengjan: puzzle', p4 !== null && p4.puzzle === 3);
check('Verðlengjan: score', p4 !== null && p4.score === 74);
check('Verðlengjan: grid', p4 !== null && p4.grid === '🎯🟩🟨🟧🟥');
const verdThu = parseShareText('🥐 Verðlengjan #4 — 107 cm\n🎯🎯🎯🎯🎯 + 🥐 fimmtudagsbonus!\ngrettisson.is/projects/verdlengjan/');
check('Verðlengjan: Thursday 107 cm', verdThu !== null && verdThu.score === 107 && verdThu.grid.includes('fimmtudagsbonus'));
check('rejects Verðlengjan without cm', parseShareText('🥐 Verðlengjan #3') === null);

check('rejects invalid text', parseShareText('hello world') === null);
check('rejects Skuggabaldur without score', parseShareText('Skuggabaldur #37 🌑') === null);
check('rejects Krillion without score line', parseShareText('Krillion #128 🦐\n🫧🫧🫧') === null);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
