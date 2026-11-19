// Headless smoke test: loads the pure-logic scripts (util/data/daily) in a
// vm context with storage stubs, then checks scoring, seeded determinism,
// persistence, streaks and the share format against the real product bank.
// Run with: node test/smoke.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const store = {};
let clipboardText = null;
const sandbox = {
  console, Math, JSON, Date, Set, Number, String, parseInt,
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  },
  navigator: { clipboard: { writeText: (t) => { clipboardText = t; return Promise.resolve(); } } },
};
vm.createContext(sandbox);
for (const f of ['util', 'data', 'daily']) {
  const p = path.join(__dirname, '..', 'src', f + '.js');
  vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: f + '.js' });
}
const bank = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'products.json'), 'utf8'));
function evalIn(expr) { return vm.runInContext(expr, sandbox); }
// const declarations live in the vm's lexical scope, not on the sandbox
// object - inject the bank through a global property instead.
sandbox.__bank = bank;
evalIn('Bank.products = __bank.products; Bank.snapshotDate = __bank.snapshotDate;');
let failures = 0;
function check(name, cond) {
  if (cond) console.log('PASS  ' + name);
  else { failures++; console.log('FAIL  ' + name); }
}

// --- bank integrity ---
check('bank has 100+ products', bank.products.length >= 100);
check('all products valid', bank.products.every((p) => p.sku && p.name && p.price > 0 && p.image && p.url));
check('cheap bucket >= 5', bank.products.filter((p) => p.price < 200).length >= 5);
check('mid bucket >= 5', bank.products.filter((p) => p.price >= 200 && p.price <= 600).length >= 5);
check('expensive bucket >= 5', bank.products.filter((p) => p.price > 1000).length >= 5);
check('fun wildcard >= 5', bank.products.filter((p) => p.fun).length >= 5);

// --- ISK formatting ---
check('formatKr', evalIn('formatKr(1499)') === '1.499 kr.');
check('parseKr plain', evalIn('parseKr("1499")') === 1499);
check('parseKr dotted', evalIn('parseKr("1.499 kr.")') === 1499);
check('parseKr junk is NaN', Number.isNaN(evalIn('parseKr("abc")')));

// --- scoring bands ---
check('exact = 20cm max growth', evalIn('scoreGuess(849, 849).tierId') === 'exact' && evalIn('scoreGuess(849,849).cm') === 20);
check('3.6% off = close 16cm', evalIn('scoreGuess(880, 849).tierId') === 'close');
check('10% off = near 12cm', evalIn('scoreGuess(934, 849).tierId') === 'near');
check('25% off = decent 8cm', evalIn('scoreGuess(1061, 849).tierId') === 'decent');
check('50% off = far 4cm', evalIn('scoreGuess(1274, 849).tierId') === 'far');
check('exactly 100% off = far (boundary)', evalIn('scoreGuess(1698, 849).tierId') === 'far');
check('over 100% off = miss, no growth', evalIn('scoreGuess(1699, 849).tierId') === 'miss' && evalIn('scoreGuess(1699,849).cm') === 0);
check('3x off = miss 0cm', evalIn('scoreGuess(2547, 849).tierId') === 'miss');
check('tiny guess = far (underbids never exceed 100%)', evalIn('scoreGuess(1, 849).tierId') === 'far');

// --- slider math ---
check('slider min = 10 kr', evalIn('sliderToPrice(0)') === 10);
check('slider max = 15000 kr', evalIn('sliderToPrice(1000)') === 15000);
check('price->slider endpoints', evalIn('priceToSlider(10)') === 0 && evalIn('priceToSlider(15000)') === 1000);
check('slider roundtrip ~500', Math.abs(evalIn('sliderToPrice(priceToSlider(500))') - 500) <= 4);
check('slider clamps out-of-range', evalIn('priceToSlider(5)') === 0 && evalIn('priceToSlider(99999)') === 1000);

// --- cm math + thursday ---
const guesses = evalIn('[scoreGuess(849,849), scoreGuess(880,849), scoreGuess(934,849), scoreGuess(1061,849), scoreGuess(2547,849)]');
check('totalCm = 2 + 20+16+12+8+0', evalIn('totalCm(' + JSON.stringify(guesses) + ', false)') === 58);
check('thursday adds 5cm', evalIn('totalCm(' + JSON.stringify(guesses) + ', true)') === 63);
check('2026-11-19 is thursday', evalIn('isThursday("2026-11-19")') === true);
check('2026-11-18 is not thursday', evalIn('isThursday("2026-11-18")') === false);
check('rank thresholds', evalIn('rankFor(107)') === 'Meistarabakari 🏆' && evalIn('rankFor(10)') === 'Alls ekki bakari');

// --- daily determinism ---
const fiveA = evalIn('buildDailyFive(Bank.products, "2026-11-18", 1).map(p=>p.sku).join(",")');
const fiveB = evalIn('buildDailyFive(Bank.products, "2026-11-18", 1).map(p=>p.sku).join(",")');
const fiveC = evalIn('buildDailyFive(Bank.products, "2026-11-19", 2).map(p=>p.sku).join(",")');
check('same date => identical five', fiveA === fiveB);
check('different date => different five', fiveA !== fiveC);
check('five unique products', new Set(fiveA.split(',')).size === 5);
const pricesA = fiveA.split(',').map((sku) => bank.products.find((p) => p.sku === sku).price);
check('daily five has cheap+mid+expensive', pricesA.some((p) => p < 200) && pricesA.some((p) => p >= 200 && p <= 600) && pricesA.some((p) => p > 1000));
check('randomFive gives 5 unique', new Set(evalIn('randomFive(Bank.products).map(p=>p.sku)')).size === 5);

// --- daily persistence ---
check('puzzle #1 on launch day', evalIn('Daily.number("2026-11-18")') === 1);
check('puzzle #2 next day', evalIn('Daily.number("2026-11-19")') === 2);
check('not played yet', evalIn('Daily.playedToday()') === false);
const res = { number: 1, date: '2026-11-18', guesses: guesses.map((g, i) => ({ sku: 'x' + i, name: 'Vara ' + i, guess: 100, price: 849, tierId: g.tierId, cm: g.cm })), totalCm: 58, thursdayBonus: false };
sandbox.__res = res;
evalIn('Daily.recordResult(__res)');
check('played after record', evalIn('Daily.playedToday()') === true);
check('streak starts at 1', evalIn('Daily.load().streak') === 1);
sandbox.__res2 = Object.assign({}, res, { totalCm: 999 });
evalIn('Daily.recordResult(__res2)');
check('one scored run per day', evalIn('Daily.todayResult().totalCm') === 58);
check('unlimited best tracked', evalIn('Daily.recordUnlimited(70); Daily.load().bestUnlimited') === 70);
evalIn('Daily.recordUnlimited(50)');
check('unlimited best keeps max', evalIn('Daily.load().bestUnlimited') === 70);

// --- share ---
const share = evalIn('Daily.shareText(__res)');
check('share header', /^🥐 Verðlengjan #1 — 58 cm\n/.test(share));
check('share emoji row', share.split('\n')[1] === '🎯🟩🟨🟧⬛');
check('share link', share.includes('grettisson.is/projects/verdlengjan/'));
check('clipboard copy', evalIn('Daily.copyShare(__res)') === true && clipboardText === share);
const shareThu = evalIn('Daily.shareText(Object.assign({}, __res, { thursdayBonus: true }))');
check('thursday bonus in share', shareThu.includes('fimmtudagsbonus'));

console.log(failures === 0 ? '\nAll checks passed.' : '\n' + failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
