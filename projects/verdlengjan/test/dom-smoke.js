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
    classList: { add() {}, remove() {} }, listeners: {}, attrs: {},
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
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
const rpcCalls = []; // captured Supabase RPC calls (stubbed, never live)
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
  fetch: async (url, opts) => {
    // Serve data/* from disk (bank, manifest, archives, history).
    if (typeof url === 'string' && url.startsWith('data/')) {
      const p = path.join(__dirname, '..', url);
      if (fs.existsSync(p)) return { json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
    }
    // Stub the Supabase RPC endpoints - record calls, never hit the network.
    if (typeof url === 'string' && url.startsWith('https://')) {
      const body = opts && opts.body ? JSON.parse(opts.body) : null;
      rpcCalls.push({ url, body });
      return { ok: true, json: async () => ({ status: 'ok', name: body && body.p_name }) };
    }
    return { json: async () => JSON.parse(bankRaw) };
  },
  Image: class { set src(v) {} },
};
vm.createContext(sandbox);
for (const f of ['util', 'data', 'daily', 'lengja', 'audio', 'leaderboard', 'game']) {
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

  // unified loaf: identical cross-section along the whole length
  const grid = evalIn('Lengja.sprite(60)');
  const inner = (row) => grid[row].slice(1, -1);
  check('chocolate + pink on top everywhere', inner(6).every((c) => 'KkPp'.includes(c)));
  check('custard line unbroken in the middle', inner(9).every((c) => c === 'C') && inner(10).every((c) => c === 'c'));
  check('almonds only on the bottom crust', grid.every((row, y) => y >= 11 || !row.some((c) => c === 'A' || c === 'a')));
  check('almonds present along the bottom', grid.slice(11, 14).some((row) => row.some((c) => c === 'A')));
  check('ruler is fixed 0-100 cm', evalIn('Lengja.ruler.style.width') === '520px');
  check('loaf fits the band', evalIn('Lengja.layout().loafW') <= 520);
  check('cm counter starts at 2', evalIn('Game.el.cm.textContent') === '2 cm');

  // slider clamps and updates the readout
  evalIn('Game.setGuess(5)');
  check('guess clamps to slider min', evalIn('Game.guessValue') === 10 && evalIn('Game.el.readout.textContent') === '10 kr.');
  evalIn('Game.setGuess(99999)');
  check('guess clamps to slider max', evalIn('Game.guessValue') === evalIn('SLIDER_MAX'));
  evalIn('Game.setGuess(849)');
  check('readout shows formatted guess', evalIn('Game.el.readout.textContent') === '849 kr.');
  check('slider has aria-valuetext', sandbox.document.getElementById('guess-slider').getAttribute('aria-valuetext') === '849 kr.');
  check('setGuess syncs type-in field', sandbox.document.getElementById('guess-input').value === '849');

  // type-in price field: valid input moves the guess, junk keeps the last one
  const gi = sandbox.document.getElementById('guess-input');
  gi.value = '1.499';
  gi.listeners.input[0]();
  check('typed price updates guess', evalIn('Game.guessValue') === 1499);
  check('typed price syncs readout', evalIn('Game.el.readout.textContent') === '1.499 kr.');
  gi.value = 'abc';
  gi.listeners.input[0]();
  check('junk typing keeps last valid guess', evalIn('Game.guessValue') === 1499);
  gi.listeners.blur[0]();
  check('junk flagged on blur', sandbox.document.getElementById('guess-error').hidden === false);
  gi.value = '849';
  gi.listeners.input[0]();
  check('valid typing clears the hint', sandbox.document.getElementById('guess-error').hidden === true);

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
  check('rank is frábært', evalIn('Game.el.rRank.textContent') === 'Frábært! 🏆');
  check('streak badge is flame + number only', /^🔥 \d+$/.test(evalIn('Game.el.rStreak.textContent')) && evalIn('Game.el.rStreak.hidden') === false);

  // stats modal computed from the saved history
  sandbox.document.getElementById('stats-btn').listeners.click[0]();
  check('stats modal opens', sandbox.document.getElementById('stats-modal').hidden === false);
  check('stats body populated', sandbox.document.getElementById('stats-body').children.length >= 3);
  sandbox.document.getElementById('stats-close').listeners.click[0]();
  check('stats modal closes', sandbox.document.getElementById('stats-modal').hidden === true);

  // price history: hidden without data for the sku, shown when older data exists
  evalIn('Game.showHistory({ sku: "no-such-sku", price: 100 })');
  check('history hidden without data for sku', sandbox.document.getElementById('price-history').hidden === true);
  evalIn('History.data = { testsku: [["2020-01-01", 300], ["2020-02-01", 399], ["2020-03-01", 399]] }');
  evalIn('Game.showHistory({ sku: "testsku", price: 499 })');
  const hist = sandbox.document.getElementById('price-history');
  check('history row shows older price', hist.hidden === false);
  check('history label + change + sparkline', hist.children.length === 3);
  check('history change computed', hist.children[1].textContent === '+25%');
  check('sparkline is svg', hist.children[2].innerHTML.includes('<polyline'));
  evalIn('History.data = null; Game.showHistory({ sku: "testsku", price: 499 })');
  check('history hides again without data', hist.hidden === true);

  // share
  evalIn('Game.share()');
  check('share copied with ' + perfect + ' cm', clipboardText && clipboardText.includes(perfect + ' cm') && clipboardText.includes('🎯🎯🎯🎯🎯'));

  // leaderboard auto-submit (stubbed Supabase RPC)
  await evalIn('Game.openLeaderboard()');
  check('leaderboard modal opens for new player', sandbox.document.getElementById('lb-modal').hidden === false);
  sandbox.document.getElementById('lb-name').value = 'PrufuBakari';
  sandbox.document.getElementById('lb-pin').value = '12';
  await evalIn('Game.submitToLeaderboard()');
  check('bad PIN rejected locally', sandbox.document.getElementById('lb-msg').textContent.includes('4 tölustafir'));
  sandbox.document.getElementById('lb-pin').value = '1234';
  await evalIn('Game.submitToLeaderboard()');
  check('leaderboard modal closes after submit', sandbox.document.getElementById('lb-modal').hidden === true);
  check('leaderboard button confirms', evalIn('Game.el.lbBtn.textContent').includes('✓'));
  const submitCall = rpcCalls.find((c) => c.url.endsWith('/submit_score'));
  check('submit_score called', !!submitCall);
  check('payload game', submitCall.body.p_game === 'verdlengjan');
  check('payload puzzle', submitCall.body.p_puzzle === evalIn('Game.number'));
  check('payload score', submitCall.body.p_score === perfect);
  check('payload grid matches share row', submitCall.body.p_grid === '🎯🎯🎯🎯🎯' + (evalIn('Game.thursday') ? ' + 🥐 fimmtudagsbonus!' : ''));
  check('payload name/pin', submitCall.body.p_name === 'PrufuBakari' && submitCall.body.p_pin === '1234');
  check('credentials cached', evalIn('Leaderboard.player().name') === 'PrufuBakari');
  const callsBefore = rpcCalls.length;
  await evalIn('Game.openLeaderboard()');
  check('cached player submits without modal', sandbox.document.getElementById('lb-modal').hidden === true && rpcCalls.length === callsBefore + 1);

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
  const smax = evalIn('SLIDER_MAX');
  let expCm = 0, misses = 0;
  for (const price of uPrices) {
    const guess = Math.min(price * 3, smax);
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
  check('leaderboard hidden in unlimited', evalIn('Game.el.lbBtn.hidden') === true);
  check('daily result untouched by unlimited', evalIn('Daily.todayResult().totalCm') === perfect);

  console.log(failures === 0 ? '\nAll DOM checks passed.' : '\n' + failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})();