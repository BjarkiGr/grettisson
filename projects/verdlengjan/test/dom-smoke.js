// Headless DOM smoke test: stubs a minimal DOM/storage/fetch, loads ALL game
// scripts, boots the game and plays full rounds through the real UI wiring:
// invalid input, five exact guesses, results, share, saved-reload, unlimited.
// Run with: node test/dom-smoke.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeEl(tag) {
  return {
    tagName: tag, children: [], style: {}, hidden: false, textContent: '',
    _innerHTML: '', href: '', src: '', value: '', alt: '',
    classList: { add() {}, remove() {} }, listeners: {},
    set innerHTML(v) { this._innerHTML = v; this.children = []; },
    get innerHTML() { return this._innerHTML; },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); },
    focus() {}, get offsetWidth() { return 100; },
  };
}
const elements = {};
const winListeners = {};
const store = {};
let clipboardText = null;
const bankRaw = fs.readFileSync(path.join(__dirname, '..', 'data', 'products.json'), 'utf8');
const sandbox = {
  console, Math, JSON, Date, Set, Number, String, parseInt, setTimeout, clearTimeout, encodeURIComponent,
  document: {
    getElementById: (id) => (elements[id] = elements[id] || makeEl('div')),
    createElement: (t) => makeEl(t),
    querySelectorAll: () => [],
  },
  window: {
    matchMedia: () => ({ matches: false }),
    addEventListener: (ev, fn) => { (winListeners[ev] = winListeners[ev] || []).push(fn); },
  },
  location: { reload() {} },
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  },
  navigator: { clipboard: { writeText: (t) => { clipboardText = t; return Promise.resolve(); } } },
  fetch: async () => ({ json: async () => JSON.parse(bankRaw) }),
  Image: class { set src(v) {} },
};
vm.createContext(sandbox);
for (const f of ['util', 'data', 'daily', 'lengja', 'audio', 'game']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f + '.js'), 'utf8'), sandbox, { filename: f + '.js' });
}
function evalIn(expr) { return vm.runInContext(expr, sandbox); }
let failures = 0;
function check(name, cond) {
  if (cond) console.log('PASS  ' + name);
  else { failures++; console.log('FAIL  ' + name); }
}
const strip = () => sandbox.document.getElementById('strip');

(async () => {
  // boot (DOMContentLoaded handler returns the boot promise)
  await winListeners.DOMContentLoaded[0]();
  check('boots into guess phase', evalIn('Game.phase') === 'guess');
  check('bank loaded', evalIn('Bank.products.length') > 100);
  check('howto shown on first visit', sandbox.document.getElementById('howto').hidden === false);
  evalIn('Game.closeHowto()');
  check('start slice on strip (endinn)', strip().children.length === 1);
  check('cm counter starts at 2', evalIn('Game.el.cm.textContent') === '2 cm');

  // slider clamps and updates the readout
  evalIn('Game.setGuess(5)');
  check('guess clamps to slider min', evalIn('Game.guessValue') === 10 && evalIn('Game.el.readout.textContent') === '10 kr.');
  evalIn('Game.setGuess(99999)');
  check('guess clamps to slider max', evalIn('Game.guessValue') === 15000);
  evalIn('Game.setGuess(849)');
  check('readout shows formatted guess', evalIn('Game.el.readout.textContent') === '849 kr.');

  // play five exact guesses -> all exact tier
  const prices = evalIn('Game.items.map(p => p.price)');
  for (const price of prices) {
    evalIn('Game.setGuess(' + price + '); Game.bake();');
    check('reveal shows after bake (price ' + price + ')', evalIn('Game.phase') === 'reveal');
    evalIn('Game.next();');
  }
  check('results phase after five', evalIn('Game.phase') === 'results');
  check('all five exact = exact tier', evalIn('Game.guesses.every(g => g.tierId === "exact")'));
  check('lengja = endinn + 5 slices', strip().children.length === 6);
  check('perfect score 102 cm', evalIn('Game.el.cm.textContent') === '102 cm');
  check('metralengjan banner fired', sandbox.document.getElementById('milestone-banner').textContent.includes('METRALENGJAN'));
  check('daily recorded', evalIn('Daily.playedToday()') === true);
  check('rank is meistarabakari', evalIn('Game.el.rRank.textContent') === 'Meistarabakari 🏆');

  // share
  evalIn('Game.share()');
  check('share copied with 102 cm', clipboardText && clipboardText.includes('102 cm') && clipboardText.includes('🎯🎯🎯🎯🎯'));

  // saved reload rebuilds the same lengja
  evalIn('Game.showSaved()');
  check('saved reload rebuilds 6 slices', strip().children.length === 6);
  check('saved reload shows results', evalIn('Game.phase') === 'results' && evalIn('Game.el.cm.textContent') === '102 cm');

  // unlimited: worst reachable guess (3x price, capped at slider max).
  // Cheap items -> miss (zero growth); very expensive items can't exceed
  // 100% error within the slider range, so compute expectations per item.
  evalIn('Game.startUnlimited()');
  check('unlimited resets strip', strip().children.length === 1);
  const uPrices = evalIn('Game.items.map(p => p.price)');
  let expCm = 0, expSlices = 0, misses = 0;
  for (const price of uPrices) {
    const guess = Math.min(price * 3, 15000);
    const s = evalIn('scoreGuess(' + guess + ', ' + price + ')');
    expCm += s.cm;
    if (s.cm > 0) expSlices++; else misses++;
    evalIn('Game.setGuess(' + guess + '); Game.bake(); Game.next();');
  }
  check('worst guesses score as expected', evalIn('Game.lastResult.totalCm') === 2 + expCm);
  check('zero-growth misses add no slice', strip().children.length === 1 + expSlices);
  check('cheap items are misses', misses >= 1);
  check('unlimited best saved', evalIn('Daily.load().bestUnlimited') === 2 + expCm);
  check('share hidden in unlimited', evalIn('Game.el.share.hidden') === true);
  check('daily result untouched by unlimited', evalIn('Daily.todayResult().totalCm') === 102);

  console.log(failures === 0 ? '\nAll DOM checks passed.' : '\n' + failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})();
