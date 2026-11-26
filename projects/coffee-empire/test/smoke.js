/* Headless smoke test for the Coffee Empire simulation. Run: node test/smoke.js */
'use strict';
require('../src/bignum.js');
require('../src/data.js');
require('../src/data2.js');
require('../src/data3.js');
require('../src/data4.js');
require('../src/data5.js');
require('../src/state.js');
require('../src/engine.js');
const CE = globalThis.CE;
const Big = CE.Big;
const E = CE.Engine;

let failures = 0;
function check(name, cond) {
  if (cond) console.log('  ok  ' + name);
  else { failures++; console.error('FAIL  ' + name); }
}
function sim(S, seconds, dt) {
  dt = dt || 0.25;
  for (let t = 0; t < seconds; t += dt) E.tick(S, dt);
}
function sane(S, label) {
  check(label + ': cash finite & >= 0', isFinite(S.cash.m) && S.cash.m >= 0);
  let neg = null, nan = null;
  for (const r in S.resources) {
    if (S.resources[r] < -1e-9) neg = r;
    if (!isFinite(S.resources[r])) nan = r;
  }
  check(label + ': no negative inventory', neg === null);
  check(label + ': no NaN inventory', nan === null);
}

console.log('== Big numbers ==');
const a = Big.fromNumber(1.5e30), b = Big.fromNumber(2e29);
check('add', Math.abs(a.add(b).toNumber() / 1.7e30 - 1) < 0.001);
check('mul', Math.abs(a.mul(b).toNumber() / 3e59 - 1) < 0.001);
check('div', Math.abs(a.div(b).toNumber() - 7.5) < 1e-9);
check('cmp huge', Big.fromNumber(1e300).gt(Big.fromNumber(1e299)));
check('pow', Big.fromNumber(1.15).pow(1000).gt(Big.fromNumber(1e60)));
check('fmt T', CE.fmt(Big.fromNumber(1.23e12)) === '1.23T');
check('fmt sci', CE.fmt(Big.fromNumber(1e80)).indexOf('e') > 0);
check('json roundtrip', JSON.parse(JSON.stringify({ x: a }), CE.bigReviver).x.eq(a));
check('maxAffordable', CE.maxAffordable(100, 1.15, 0, Big.fromNumber(1000)) === 6);

console.log('== Data integrity ==');
check('48 businesses', CE.BUSINESSES.length === 48);
check('276+ upgrades', CE.UPGRADES.length + CE.REPEATABLES.length >= 276);
check('research reqs exist', CE.RESEARCH.every(r => r.req.every(q => CE.RESEARCH_MAP[q])));
check('recipes reference real resources', CE.BUSINESSES.every(bz => !bz.recipes || bz.recipes.every(rc =>
  Object.keys(rc.in).every(r => CE.RESOURCES[r]) && Object.keys(rc.out).every(r => CE.RESOURCES[r]))));
check('menus reference real drinks', CE.BUSINESSES.every(bz => !bz.menu || bz.menu.every(d => CE.DRINKS[d])));
check('sells reference real resources', CE.BUSINESSES.every(bz => !bz.sells || bz.sells.every(s => CE.RESOURCES[s.res])));

console.log('== Early game ==');
const S = CE.newState();
CE.applyLegacyStart(S);
check('starts with $100', S.cash.eq(Big.fromNumber(100)));
check('starts with 1 cart', E.totalOwned(S, 'cart') === 1);
const brew = E.brew(S, 'regular');
check('manual brew works', brew && brew.cups >= 1 && S.cash.gt(Big.fromNumber(100)));
const cupsBeforeIdle = S.stats.cups, revBeforeIdle = S.stats.revenue.clone();
sim(S, 60);
sane(S, 'after 60s idle');
check('unstaffed cart produces NOTHING (no passive start)', S.stats.cups === cupsBeforeIdle && S.stats.revenue.eq(revBeforeIdle));
check('hire locked before milestone', E.hire(S, 'barista', 1) === 0);
E.buyResource(S, 'roasted', 5);
E.buyResource(S, 'water', 50);
S.cash = S.cash.add(Big.fromNumber(500));
S.staffUnlocked.barista = true;
check('hire barista', E.hire(S, 'barista', 1) === 1);
const cupsBeforeStaffed = S.stats.cups;
sim(S, 30);
check('staffed cart brews automatically', S.stats.cups > cupsBeforeStaffed);
const cashBefore = S.cash.clone();
sim(S, 300);
check('staffed cart earns', S.cash.gt(cashBefore));
check('first employee achievement', !!S.achievements.firstEmployee);
check('first cup achievement', !!S.achievements.firstCup);
console.log('== Production chain ==');
S.cash = Big.fromNumber(1e6);
S.stats.revenue = Big.fromNumber(1e6);
for (const b of CE.BUSINESSES) S.discovered[b.id] = true;
for (const t in CE.STAFF) S.staffUnlocked[t] = true;
E.buyBiz(S, 'smallFarm', 5); E.hire(S, 'farmWorker', 5);
E.buyBiz(S, 'processing', 3); E.buyBiz(S, 'roastery', 3);
E.hire(S, 'factoryWorker', 12);
E.buyBiz(S, 'localWarehouse', 2); E.hire(S, 'logisticsWorker', 2);
E.dirty = true;
sim(S, 600);
sane(S, 'after chain 600s');
check('farm harvested cherries', S.stats.beans > 0);
check('roastery made roasted beans', S.resources.roasted > 0);
check('vertical chain flows', E.flow.prod.roasted > 0);

console.log('== Research & automation ==');
S.rp = 1000;
if (S.researchCatsUnlocked.indexOf('Automation') < 0) S.researchCatsUnlocked.push('Automation');
check('start research', E.startResearch(S, 'autoInventory'));
sim(S, 120);
check('research completed', !!S.research.done.autoInventory);
E.ensureMods(S);
check('autoBuy unlocked', E.mods.unlocks.autoBuy === true);
S.supply.milk.auto = true; S.supply.water.auto = true; S.supply.roasted.auto = true;
S.resources.milk = 0;
sim(S, 120);
check('auto-purchased milk', S.resources.milk > 0);

console.log('== Save / load ==');
const json = CE.serialize(S);
const S2 = CE.deserialize(json);
check('cash survives', S2.cash.eq(S.cash));
check('businesses survive', E.totalOwned(S2, 'smallFarm') === 5);
check('research survives', !!S2.research.done.autoInventory);
check('Big reviver nested', S2.stats.revenue instanceof Big);

console.log('== Offline progression ==');
const S3 = CE.deserialize(json);
E.dirty = true;
const sum = E.simulateOffline(S3, 8 * 3600);
check('offline revenue > 0', sum.revenue.gt(Big.ZERO));
check('offline respects cap', sum.seconds <= 12 * 3600);
check('offline produced', sum.cups > 0);
sane(S3, 'after 8h offline');
const sum2 = E.simulateOffline(S3, 48 * 3600);
check('48h capped to 12h', sum2.capped && sum2.seconds === 12 * 3600);

console.log('== Events, market, competitors ==');
check('market moved', Object.values(S3.markets).some(mk => mk.factor !== 1));
check('events occurred', S3.stats.events > 0);
check('competitors grew', S3.competitors[0].val.gt(Big.fromNumber(5e4)));
const share = E.marketShare(S3);
check('market share in [0,1]', share >= 0 && share <= 1);

console.log('== Prestige ==');
S3.stats.runRevenue = Big.fromNumber(1e11);
const gain = E.prestigeGain(S3);
check('prestige gain = 10', gain === 10);
const res = E.prestige(S3);
check('prestige resets cash', res.state.cash.eq(Big.fromNumber(100)));
check('prestige keeps achievements', !!res.state.achievements.firstCup);
check('prestige keeps lifetime stats', res.state.stats.revenue.gt(Big.ZERO));
check('legacy points granted', res.state.legacy.points === 10);
check('buy legacy upgrade', E.buyLegacy(res.state, 'lg_capital'));
CE.applyLegacyStart(res.state);
check('legacy capital x10', res.state.cash.eq(Big.fromNumber(1000)));

console.log('== Long-run stability (2h sim, big portfolio) ==');
const S4 = CE.newState();
S4.cash = Big.fromNumber(1e15);
S4.stats.revenue = Big.fromNumber(1e15);
S4.brand = 80;
for (const bz of CE.BUSINESSES) S4.discovered[bz.id] = true;
for (const t in CE.STAFF) S4.staffUnlocked[t] = true;
for (const d in CE.DRINKS) S4.recipesUnlocked[d] = true;
S4.researchCatsUnlocked = CE.RESEARCH_CATS.slice();
for (const bz of CE.BUSINESSES) { E.buyBiz(S4, bz.id, 10); }
for (const t in CE.STAFF) E.hire(S4, t, 5000);
S4.rp = 1e6;
for (const r of CE.RESEARCH) { S4.research.done[r.id] = true; }
E.dirty = true;
sim(S4, 7200, 1);
sane(S4, 'after 2h mega-portfolio');
check('mega portfolio profitable', S4.rates.profit.gt(Big.ZERO));
check('revenue rate huge but finite', isFinite(S4.rates.rev.m) && S4.rates.rev.gt(Big.fromNumber(1e6)));
check('valuation computed', E.valuation(S4).gt(S4.cash));

console.log('== Conservation & controls ==');
const S5 = CE.newState();
S5.cash = Big.ZERO;
S5.biz.cart.regions.na = 0; /* isolate: no other income source */
S5.biz.packagingFactory.regions.na = 1;
S5.staff.factoryWorker.n = 10;
E.dirty = true;
sim(S5, 60);
check('no cash -> no free packaging (conservation)', S5.resources.packaging === 0);
S5.cash = Big.fromNumber(1000);
E.dirty = true;
sim(S5, 60);
check('with cash -> packaging produced', S5.resources.packaging > 0);
check('raw materials charged as COGS', S5.stats.cogs.gt(Big.ZERO));
E.togglePause(S5, 'packagingFactory');
const pBefore = S5.resources.packaging;
sim(S5, 30);
check('paused facility produces nothing', S5.resources.packaging === pBefore);
E.togglePause(S5, 'packagingFactory');

console.log('== Divisions & merging ==');
const S6 = CE.newState();
S6.cash = Big.fromNumber(1e12);
E.dirty = true;
check('division requires unlocked region', !E.establishDivision(S6, 'eu'));
E.unlockRegion(S6, 'eu');
check('division established', E.establishDivision(S6, 'eu'));
S6.subsidiaries = [{ name: 'A', rev: 100, val: Big.fromNumber(1e9) }, { name: 'B', rev: 200, val: Big.fromNumber(2e9) }];
check('merge subsidiaries', E.mergeSubsidiaries(S6) && S6.subsidiaries.length === 1 && Math.abs(S6.subsidiaries[0].rev - 330) < 1e-6);

console.log('== JSON export & save recovery ==');
const j = CE.exportSave(S6);
check('export is JSON', j[0] === '{');
const S7 = CE.importSave(j);
check('JSON import roundtrip', S7.cash.eq(S6.cash));
const store = {};
globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
CE.save(S6); CE.save(S6); /* second save creates the backup */
store[CE.SAVE_KEY] = '{corrupted';
const S8 = CE.load();
check('recovered from backup', !!S8 && !!CE.loadWarning && S8.cash.eq(S6.cash));

console.log('== Interactive brew session ==');
const S9 = CE.newState();
CE.applyLegacyStart(S9);
E.dirty = true;
check('select drink', E.brewSelect(S9, 'espresso'));
const cash0 = S9.cash.clone(), roasted0 = S9.resources.roasted;
check('start grind step', E.brewStartStep(S9));
check('grind consumed beans', S9.resources.roasted < roasted0);
check('cannot double-start step', E.brewStartStep(S9) === false);
check('no payment before serve', S9.cash.eq(cash0));
for (let i = 0; i < 40; i++) { E.tick(S9, 0.25); if (!S9.brewSession.running && S9.brewSession.step > 0) E.brewStartStep(S9); }
check('session completed a sale', S9.stats.cups >= 1 && S9.cash.gt(cash0));
check('no negative inventory after session', Object.values(S9.resources).every(v => v >= -1e-9));

console.log('== Milestones & discovery ==');
const S10 = CE.newState();
CE.applyLegacyStart(S10);
E.dirty = true;
check('only cart discovered at start', Object.keys(S10.discovered).length === 1);
check('only 2 recipes at start', Object.keys(S10.recipesUnlocked).length === 2);
E.brew(S10, 'regular');
sim(S10, 2);
check('firstCup milestone completed', !!S10.milestones.firstCup);
S10.stats.revenue = Big.fromNumber(600);
sim(S10, 2);
check('rev250 milestone unlocks barista', !!S10.staffUnlocked.barista);
check('rev500 milestone discovers shop', !!S10.discovered.smallShop);
check('americano recipe unlocked via sell10? (needs cups)', !S10.recipesUnlocked.americano || S10.stats.cups >= 10);

console.log('== Save migration v1 -> v2 ==');
const S11 = CE.newState();
S11.cash = Big.fromNumber(5e6);
S11.stats.revenue = Big.fromNumber(5e6);
S11.biz.smallShop.regions.na = 3;
S11.staff.barista.n = 6;
S11.upgrades.machines1 = 1;
S11.research.done.advIrrigation = true;
S11.achievements.firstCup = Date.now();
const v1 = JSON.parse(CE.serialize(S11));
v1.version = 1;
delete v1.discovered; delete v1.milestones; delete v1.staffUnlocked;
delete v1.recipesUnlocked; delete v1.researchCatsUnlocked; delete v1.features; delete v1.brewSession;
const S12 = CE.deserialize(JSON.stringify(v1));
check('migration preserves cash', S12.cash.eq(Big.fromNumber(5e6)));
check('migration preserves businesses', E.totalOwned(S12, 'smallShop') === 3);
check('migration preserves research/upgrades/achievements', !!S12.research.done.advIrrigation && !!S12.upgrades.machines1 && !!S12.achievements.firstCup);
check('migration initializes discovery', !!S12.discovered.smallShop && !!S12.discovered.cart);
check('migration unlocks legacy staff/recipes', !!S12.staffUnlocked.barista && !!S12.recipesUnlocked.latte);
check('migration backfills milestones silently', !!S12.milestones.rev250);
check('migration version bumped', S12.version === CE.SAVE_VERSION);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : '\n' + failures + ' CHECKS FAILED');
process.exit(failures === 0 ? 0 : 1);

