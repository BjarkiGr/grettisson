/* Headless UI test with a minimal DOM shim. Run: node test/ui.js */
'use strict';
let failures = 0;
function check(name, cond) {
  if (cond) console.log('  ok  ' + name);
  else { failures++; console.error('FAIL  ' + name); }
}
function el(tag) {
  return {
    tag, children: [], style: {}, dataset: {}, value: '', textContent: '', className: '',
    classList: { add() {}, remove() {}, toggle() {} },
    set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html || ''; },
    appendChild(c) { this.children.push(c); }, remove() {}, select() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 10 }; },
    get firstChild() { return this.children[0]; },
    scrollTop: 0, src: '',
    getContext() {
      return {
        fillRect() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
        stroke() {}, fill() {}, closePath() {}, fillText() {}, drawImage() {},
        fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', imageSmoothingEnabled: false
      };
    },
    toDataURL() { return 'data:image/png;base64,x'; },
    width: 0, height: 0
  };
}
const byId = {};
globalThis.document = {
  readyState: 'complete',
  body: el('body'),
  querySelector(sel) { if (!byId[sel]) byId[sel] = el('q'); return byId[sel]; },
  getElementById(id) { if (!byId['#' + id]) byId['#' + id] = el('div'); return byId['#' + id]; },
  querySelectorAll() { return []; },
  createElement(tag) { return el(tag); },
  addEventListener() {}, removeEventListener() {},
  hidden: false
};
globalThis.window = undefined;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.btoa = s => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = s => Buffer.from(s, 'base64').toString('binary');

require('../src/bignum.js');
require('../src/data.js');
require('../src/data2.js');
require('../src/data3.js');
require('../src/data4.js');
require('../src/data5.js');
require('../src/sprites.js');
require('../src/scene.js');
require('../src/state.js');
require('../src/engine.js');
require('../src/ui.js');
require('../src/ui2.js');
require('../src/ui3.js');
require('../src/ui4.js');
require('../src/tutorial.js');
const CE = globalThis.CE;
CE.Audio = { blip() {}, cue() {}, setMusic() {}, ensure() {} };
const E = CE.Engine, UI = CE.UI, Big = CE.Big;

console.log('== Sprites ==');
const url = CE.spriteURL('cart', 64);
check('sprite renders', typeof url === 'string' && url.length > 0);
let allSprites = true;
for (const b of CE.BUSINESSES) { try { CE.spriteURL(b.sprite, 64); } catch (e) { allSprites = false; console.error(b.sprite, e.message); } }
check('all 48 business sprites render', allSprites);

console.log('== Sections render & update ==');
const S = CE.newState();
CE.applyLegacyStart(S);
S.cash = Big.fromNumber(1e12);
S.stats.revenue = Big.fromNumber(1e12);
S.brand = 60; S.rp = 5000;
/* Rendering test: unlock every section explicitly (visibility itself is
   covered by test/overhaul.js). */
for (const id of ['overview', 'brew', 'businesses', 'milestones', 'staff', 'production', 'locations', 'farms', 'research', 'markets', 'corporate', 'achievements', 'statistics']) S.tabsUnlocked[id] = true;
S.tutorial.done = true;
E.dirty = true;
E.tick(S, 1);
UI.init(S);
const sections = ['overview', 'brew', 'businesses', 'milestones', 'staff', 'production', 'locations', 'farms', 'research', 'markets', 'corporate', 'achievements', 'statistics'];
for (const name of sections) {
  try {
    UI.show(name);
    for (let i = 0; i < 5; i++) { E.tick(S, 0.5); UI.update(); }
    check(name + ' renders + updates', true);
  } catch (e) {
    check(name + ' renders + updates (' + e.message + ')', false);
  }
}

console.log('== Click actions ==');
function click(dataset) {
  UI.onClick({ target: { closest: () => ({ dataset, getBoundingClientRect: () => ({ left: 0, top: 0, width: 10 }) }) } });
}
try {
  click({ action: 'nav', id: 'businesses' });
  click({ action: 'buyqty', id: '10' });
  click({ action: 'buybiz', id: 'cart' });
  check('buy 10 carts', E.totalOwned(S, 'cart') >= 11);
  S.staffUnlocked.barista = true;
  click({ action: 'hire', id: 'barista', n: '10' });
  check('hire 10 baristas', S.staff.barista.n >= 10);
  click({ action: 'brew', id: 'regular' });
  click({ action: 'buyres', id: 'roasted', qty: '100' });
  /* Interactive brew session through the UI */
  click({ action: 'brew-select', id: 'espresso' });
  check('brew session selected', S.brewSession && S.brewSession.drink === 'espresso');
  click({ action: 'brew-step' });
  check('brew step running', S.brewSession.running === true);
  for (let i = 0; i < 30; i++) { E.tick(S, 0.25); if (S.brewSession && !S.brewSession.running && S.brewSession.step > 0) click({ action: 'brew-step' }); }
  check('brew session served via UI', S.stats.cups > 1);
  if (S.researchCatsUnlocked.indexOf('Automation') < 0) S.researchCatsUnlocked.push('Automation');
  click({ action: 'research', id: 'autoInventory' });
  check('research started via click', S.research.active && S.research.active.id === 'autoInventory');
  click({ action: 'campaign', id: 'flyers' });
  check('campaign launched', S.campaigns.length === 1);
  click({ action: 'setregion', id: 'na' });
  click({ action: 'pausebiz', id: 'cart' });
  check('pause via UI', S.biz.cart.paused === true);
  click({ action: 'pausebiz', id: 'cart' });
  click({ action: 'division', id: 'na' });
  check('division via UI', S.regions.na.division === true);
  S.subsidiaries = [{ name: 'A', rev: 10, val: Big.fromNumber(1e6) }, { name: 'B', rev: 20, val: Big.fromNumber(2e6) }];
  click({ action: 'mergesubs' });
  check('merge via UI', S.subsidiaries.length === 1);
  click({ action: 'bell' });
  click({ action: 'modal-close' });
  click({ action: 'settings' });
  click({ action: 'modal-close' });
  click({ action: 'export' });
  click({ action: 'modal-close' });
  check('click actions survive', true);
} catch (e) {
  check('click actions (' + e.message + ')', false);
}

console.log('== Offline modal & structure ==');
try {
  const sum = E.simulateOffline(S, 3600);
  UI.offlineModal(sum);
  UI.closeModal();
  UI.checkStructure();
  check('offline modal + structure check', true);
} catch (e) {
  check('offline modal (' + e.message + ')', false);
}

console.log('== Tutorial flow (interactive) ==');
try {
  const ST = CE.newState();
  CE.applyLegacyStart(ST);
  E.dirty = true;
  UI.init(ST);
  CE.Tutorial.start(ST);
  check('tutorial starts at welcome', ST.tutorial.active === true && ST.tutorial.step === 0);
  click({ action: 'tut-next' });
  check('welcome advances to pick-a-drink', ST.tutorial.step === 1);
  click({ action: 'brew-select', id: 'regular' });
  CE.Tutorial.update(ST);
  check('selecting a drink advances the tutorial', ST.tutorial.step === 2);
  for (let i = 0; i < 60 && ST.tutorial.step < 4; i++) {
    E.tick(ST, 0.25);
    if (ST.brewSession && !ST.brewSession.running) click({ action: 'brew-step' });
    CE.Tutorial.update(ST);
  }
  check('brewing + serving reaches the money step', ST.tutorial.step === 4);
  click({ action: 'tut-next' });
  check('money step advances to first upgrade', ST.tutorial.step === 5);
  ST.cash = Big.fromNumber(100);
  click({ action: 'upgrade', id: 'paperCups' });
  CE.Tutorial.update(ST);
  check('buying the first upgrade completes the guide', ST.tutorial.step === 6);
  click({ action: 'tut-next' });
  check('tutorial completion is recorded', ST.tutorial.done === true && ST.tutorial.active === false);
  const ST2 = CE.deserialize(CE.serialize(ST));
  check('completed tutorial persists', ST2.tutorial.done === true);
  CE.Tutorial.start(ST2);
  check('tutorial can be replayed', ST2.tutorial.active === true && ST2.tutorial.step === 0);
  CE.Tutorial.skip(ST2);
  check('tutorial can be skipped', ST2.tutorial.skipped === true && ST2.tutorial.active === false);
} catch (e) {
  check('tutorial flow (' + e.message + ')', false);
}

console.log(failures === 0 ? '\nALL UI CHECKS PASSED' : '\n' + failures + ' UI CHECKS FAILED');
process.exit(failures === 0 ? 0 : 1);
