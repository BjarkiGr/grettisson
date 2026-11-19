// Headless DOM smoke test: stubs a minimal DOM/storage/fetch, loads ALL game
// scripts, boots to the start screen, clicks start and plays full rounds
// through the real UI wiring: five exact guesses, results, share,
// saved-reload, unlimited. Thursday-aware (the +5 cm bonus applies on Thu).
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
const svgCount = () => (strip().innerHTML.match(/<svg/g) || []).length;

(async () => {
  // boot (DOMContentLoaded handler returns the boot promise)
  await winListeners.DOMContentLoaded[0]();
  check('boots into start screen', evalIn('Game.phase') === 'start');
  check('start screen visible', sandbox.document.getElementById('start-phase').hidden === false);
  check('bank loaded', evalIn('Bank.products.length') >= 101);
  check('start button invites to bake', sandbox.document.getElementById('start-btn').textContent.includes('Búa til vínarbrauð dagsins'));
  sandbox.document.getElementById('start-btn').listeners.click[0]();
  check('start enters guess phase', evalIn('Game.phase') === 'guess');
  check('howto shown on first visit', sandbox.document.getElementById('howto').hidden === false);
  evalIn('Game.closeHowto()');
  check('endinn on the strip (2 cm)', evalIn('Lengja.totalCm') === 2 && strip().innerHTML.includes('<svg'));
  check('lengja is one seamless svg', svgCount() === 1);
  check('ruler is fixed 0-100 cm', evalIn('Lengja.ruler.style.width') === '520px');
  check('loaf fits the band', evalIn('Lengja.layout().loafW') <= 520);
  check('cm counter starts at 2', evalIn('Game.el.cm.textContent') === '2 cm');

  // slider clamps and updates the readout
  evalIn('Game.setGuess(5)');
  check('guess clamps to slider min', evalIn('Game.guessValue') === 10 && evalIn('Game.el.readout.textContent') === '10 kr.');
  evalIn('Game.setGuess(99999)');
  check('guess clamps to slider max', evalIn('Game.guessValue') === 15000);
  evalIn('Game.setGuess(849)');
  check('readout shows formatted guess', evalIn('Game.el.readout.textContent') === '849 kr.');

  // play five exact guesses => all exact tier (thursday adds +5 cm)
  const bonus = evalIn('Game.thursday') ? 5 : 0;
  const perfect = 102 + bonus;
  const prices = evalIn('Game.items.map(p => p.price)');
  for (const price of prices) {
    evalIn('Game.setGuess(' + price + '); Game.bake();');
    check('reveal shows after bake (price ' + price + ')', evalIn('Game.phase') === 'reveal');
    evalIn('Game.next();');
  }
  check('results phase after five', evalIn('Game.phase') === 'results');
  check('all five exact = exact tier', evalIn('Game.guesses.every(g => g.tierId === "exact")'));
  check('lengja still one seamless svg', svgCount() === 1);
  check('perfect score ' + perfect + ' cm', evalIn('Game.el.cm.textContent') === perfect + ' cm');
  check('metralengjan banner fired', sandbox.document.getElementById('milestone-banner').textContent.includes('METRALENGJAN'));
  check('daily recorded', evalIn('Daily.playedToday()') === true);
  check('rank is meistarabakari', evalIn('Game.el.rRank.textContent') === 'Meistarabakari 🏆');

  // share
  evalIn('Game.share()');
  check('share copied with ' + perfect + ' cm', clipboardText && clipboardText.includes(perfect + ' cm') && clipboardText.includes('🎯🎯🎯🎯🎯'));

  // saved reload rebuilds the same loaf
  evalIn('Game.showSaved()');
  check('saved reload rebuilds the loaf', evalIn('Lengja.totalCm') === perfect && svgCount() === 1);
  check('saved reload shows results', evalIn('Game.phase') === 'results' && evalIn('Game.el.cm.textContent') === perfect + ' cm');

  // unlimited: worst reachable guess (3x price, capped at slider max).
  // Cheap items => miss (zero growth); very expensive items can't exceed
  // 100% error within the slider range, so compute expectations per item.
  evalIn('Game.startUnlimited()');
  check('unlimited resets loaf', evalIn('Lengja.totalCm') === 2);
  const uPrices = evalIn('Game.items.map(p => p.price)');
  let expCm = 0, misses = 0;
  for (const price of uPrices) {
    const guess = Math.min(price * 3, 15000);
    const s = evalIn('scoreGuess(' + guess + ', ' + price + ')');
    expCm += s.cm;
    if (s.cm === 0) misses++;
    evalIn('Game.setGuess(' + guess + '); Game.bake(); Game.next();');
  }
  check('worst guesses score as expected', evalIn('Game.lastResult.totalCm') === 2 + expCm);
  check('zero-growth misses add no length', evalIn('Lengja.totalCm') === 2 + expCm);
  check('cheap items are misses', misses >= 1);
  check('unlimited best saved', evalIn('Daily.load().bestUnlimited') === 2 + expCm);
  check('share hidden in unlimited', evalIn('Game.el.share.hidden') === true);
  check('daily result untouched by unlimited', evalIn('Daily.todayResult().totalCm') === perfect);

  console.log(failures === 0 ? '\nAll DOM checks passed.' : '\n' + failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})();