// Smoke test for the static Daily Games Stats leaderboard (6 games).
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
for (const g of ['sizeitup', 'skuggabaldur', 'krillion', 'verdlengjan', 'timeguessr', 'farflung']) {
  check(`#gameTab-${g} in index.html`, html.includes(`id="gameTab-${g}"`));
}

// 3b. Admin functions must exist.
for (const fn of ['isAdmin', 'adminDeleteScore', 'adminDeletePlayer', 'adminResetPin', 'init']) {
  check(`admin fn ${fn}() defined`, js.includes(`function ${fn}(`));
}

// 4. Parsers against real Share texts from all four games.
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

const timeSample = [
  'TimeGuessr #1275 — 42,390/50,000', '',
  '1️⃣ 🏆9,846 · 📅 0y · 🌍 13.5mi',
  '2️⃣ 🏆8,764 · 📅 6y · 🌍 26.7mi',
  '3️⃣ 🏆8,763 · 📅 0y · 🌍 313.4mi',
  '4️⃣ 🏆6,859 · 📅 14y · 🌍 30.9mi',
  '5️⃣ 🏆8,158 · 📅 1y · 🌍 528.5mi', '',
  'https://timeguessr.com'
].join('\n');
const p5 = parseShareText(timeSample);
check('TimeGuessr: detected', p5 !== null && p5.game === 'timeguessr');
check('TimeGuessr: puzzle', p5 !== null && p5.puzzle === 1275);
check('TimeGuessr: score (comma stripped)', p5 !== null && p5.score === 42390);
check('TimeGuessr: rounds', p5 !== null && JSON.stringify(p5.rounds) === JSON.stringify([9846, 8764, 8763, 6859, 8158]));
check('TimeGuessr: grid 5 lines', p5 !== null && p5.grid.split('\n').length === 5);
check('TimeGuessr: no URL in grid', p5 !== null && !p5.grid.includes('https'));
check('rejects TimeGuessr without score', parseShareText('TimeGuessr #1275\nhttps://timeguessr.com') === null);

const farflungSample = [
  'Farflung #53 · 265/500 km',
  'Uncommon · Uncommon · Rare · Miss · Elusive',
  'https://farflung.game/s/8d3wxp?e=53'
].join('\n');
const p6 = parseShareText(farflungSample);
check('Farflung: detected', p6 !== null && p6.game === 'farflung');
check('Farflung: puzzle', p6 !== null && p6.puzzle === 53);
check('Farflung: score', p6 !== null && p6.score === 265);
check('Farflung: rarity grid', p6 !== null && p6.grid === 'Uncommon · Uncommon · Rare · Miss · Elusive');
check('Farflung: no URL in grid', p6 !== null && !p6.grid.includes('https'));
check('rejects Farflung without km', parseShareText('Farflung #53\nhttps://farflung.game') === null);

// 4b. Farflung: lower is better — daily + average standings rank ascending.
const gsStart = js.indexOf('function getStandings');
const gsEnd = js.indexOf('function renderAll');
const gsSnippet = js.slice(gsStart, gsEnd);
const gamesStub = { farflung: { lowerBetter: true }, sizeitup: {} };
const ffScores = [
  { game: 'farflung', puzzle: 53, name: 'a', score: 265 },
  { game: 'farflung', puzzle: 53, name: 'b', score: 120 },
  { game: 'farflung', puzzle: 53, name: 'c', score: 400 },
  { game: 'farflung', puzzle: 52, name: 'a', score: 90 }
];
const gsDoc = { getElementById: () => ({ value: '53' }) };
const runStandings = (mode) => new Function('document', 'state', 'GAMES', gsSnippet + '\nreturn getStandings();')(gsDoc, { game: 'farflung', mode, scores: ffScores }, gamesStub);
const ffDaily = runStandings('daily');
check('Farflung: lower score wins daily', ffDaily.length === 3 && ffDaily[0].name === 'b' && ffDaily[2].name === 'c');
const ffAvg = runStandings('average');
check('Farflung: average ranked ascending', ffAvg[0].name === 'b' && ffAvg[2].name === 'c');
check('Farflung: best = minimum', ffAvg.find(p => p.name === 'a').best === 90);
check('Farflung: lowerBetter flag in GAMES', /farflung:\s*\{[^}]*lowerBetter:\s*true/.test(js));

// 4c. SQL: new games allowed + max scores in setup and migration.
const setupSql = readFileSync(path.join(dir, 'supabase-setup.sql'), 'utf8');
const tgffSql = readFileSync(path.join(dir, 'supabase-migration-timeguessr-farflung.sql'), 'utf8');
for (const [label, sql] of [['setup', setupSql], ['migration', tgffSql]]) {
  check(`SQL ${label}: allows timeguessr + farflung`, sql.includes("'verdlengjan', 'timeguessr', 'farflung'"));
  check(`SQL ${label}: TimeGuessr max 50000`, sql.includes("when 'timeguessr' then 50000"));
  check(`SQL ${label}: Farflung max 500`, sql.includes("when 'farflung' then 500"));
}

check('rejects invalid text', parseShareText('hello world') === null);
check('rejects Skuggabaldur without score', parseShareText('Skuggabaldur #37 🌑') === null);
check('rejects Krillion without score line', parseShareText('Krillion #128 🦐\n🫧🫧🫧') === null);

// 5. Participation panel: wiring, per-day counts, visibility.
check('renderParticipation() defined', js.includes('function renderParticipation('));
const pStart = js.indexOf('const VERD_EPOCH');
const pEnd = js.indexOf('function renderPodium');
const snippet = js.slice(pStart, pEnd);
const els = { participationCard: { style: {}, innerHTML: '' }, participationBody: { style: {}, innerHTML: '' } };
const doc = { getElementById: (id) => els[id] };
const panelScores = [
  { game: 'verdlengjan', puzzle: 7, name: 'a', score: 80 },
  { game: 'verdlengjan', puzzle: 7, name: 'b', score: 90 },
  { game: 'verdlengjan', puzzle: 6, name: 'a', score: 70 },
  { game: 'sizeitup', puzzle: 7, name: 'c', score: 300 }
];
const runPanel = (user, traffic) => new Function('document', 'state', snippet + '\nrenderParticipation();')(doc, { game: 'verdlengjan', currentUser: user, scores: panelScores, traffic });
runPanel({ name: 'bjarki' }, [{ puzzle: 7, visits: 5, completes: 3 }, { puzzle: 6, visits: 2, completes: 2 }]);
check('participation: visible when logged in', els.participationCard.style.display === 'block');
check('participation: traffic visits + completes per day', els.participationBody.innerHTML.includes('5 heimsóknir · 3 kláruðu') && els.participationBody.innerHTML.includes('2 heimsóknir · 2 kláruðu'));
check('participation: traffic totals', els.participationBody.innerHTML.includes('7 heimsóknir · 5 kláruðu'));
check('participation: puzzle date label', els.participationBody.innerHTML.includes('#7 · 24.11.'));
runPanel({ name: 'bjarki' }, null);
check('participation: fallback counts submissions', els.participationBody.innerHTML.includes('2 leikmenn') && els.participationBody.innerHTML.includes('3 skráð skor'));
runPanel(null);
check('participation: hidden when logged out', els.participationCard.style.display === 'none');
const verdDate = new Function(snippet + '\nreturn verdPuzzleDate;')();
check('participation: epoch matches game (#1 = 18.11.)', verdDate(1) === '18.11.');

// 6. Feedback (ábendingar): security wiring.
const fbSql = readFileSync(path.join(dir, 'supabase-migration-feedback.sql'), 'utf8');
check('feedback: parameterized insert (no SQL concat)', fbSql.includes('insert into feedback (name, message) values (v_name, v_msg)'));
check('feedback: no dynamic SQL (execute/format)', !/execute\s+(format|'|"|v_)/i.test(fbSql));
check('feedback: admin read verifies PIN + is_admin', fbSql.includes('get_feedback') && fbSql.includes('not v_user.is_admin'));
check('feedback: message length constrained server-side', fbSql.includes('between 1 and 2000'));
check('feedback: rate limits present', fbSql.includes("interval '1 hour'"));
check('feedback: RLS enabled', fbSql.includes('alter table public.feedback enable row level security'));
check('feedback: rendered messages are HTML-escaped', js.includes('${esc(f.message)}'));
check('feedback: delete id is numeric-only in onclick', js.includes('adminDeleteFeedback(${Number(f.id)})'));
check('feedback: submitFeedback defined', js.includes('function submitFeedback('));
check('feedback: adminDeleteFeedback defined', js.includes('function adminDeleteFeedback('));

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
