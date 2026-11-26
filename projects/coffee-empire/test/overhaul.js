/* Overhaul tests: AFK-safe early economy, offline balance, progression-based
   tab visibility, tutorial persistence, v2->v3 save migration, first upgrade.
   Run: node test/overhaul.js */
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
const Big = CE.Big, E = CE.Engine;

let failures = 0;
function check(name, cond) {
  if (cond) console.log('  ok  ' + name);
  else { failures++; console.error('FAIL  ' + name); }
}
function sim(S, seconds, dt) {
  dt = dt || 0.5;
  for (let t = 0; t < seconds; t += dt) E.tick(S, dt);
}

console.log('== Phase 1: AFK protection ==');
const S1 = CE.newState();
CE.applyLegacyStart(S1);
E.dirty = true;
sim(S1, 7200); /* 2 hours unattended, no staff, no input */
check('2h AFK with no staff never bankrupts (floor $25)', S1.cash.gteNum(24.99));
check('closed cart costs NOTHING — starting cash untouched', S1.cash.gteNum(99.99));
check('no passive income introduced', S1.stats.cups === 0);

const S2 = CE.newState();
CE.applyLegacyStart(S2);
S2.cash = Big.fromNumber(300);
S2.staffUnlocked.barista = true;
E.hire(S2, 'barista', 1);
E.dirty = true;
sim(S2, 7200); /* 2h AFK after hiring, never restocking */
check('barista sold the starting stock', S2.stats.cups > 0);
check('2h AFK out-of-stock never bankrupts', S2.cash.gteNum(24.99));

const S3 = CE.newState();
E.dirty = true;
E.tick(S3, 1);
check('closed (unstaffed) cart has zero operating cost', S3.rates.exp.toNumber() < 1e-9);

const S4 = CE.newState();
S4.stats.runRevenue = Big.fromNumber(1e6); /* past early game */
S4.cash = Big.fromNumber(30);
S4.staffUnlocked.barista = true;
S4.staff.barista.n = 5;
for (const r in S4.resources) S4.resources[r] = 0; /* out of stock: pure costs */
E.dirty = true;
sim(S4, 600);
check('empty staffed shop still pays rent (costs stay meaningful)', S4.cash.lt(Big.fromNumber(30)) && S4.rates.exp.gt(Big.ZERO));
check('permanent floor protects established runs too', S4.cash.gteNum(24.99));

const S4b = CE.newState();
S4b.stats.runRevenue = Big.fromNumber(1e6);
S4b.cash = Big.fromNumber(100);
S4b.staffUnlocked.barista = true;
S4b.staff.barista.n = 5;
for (const r in S4b.resources) S4b.resources[r] = 0;
E.dirty = true;
sim(S4b, 7200); /* 2h AFK mid-game, out of stock */
check('2h mid-game AFK never bankrupts', S4b.cash.gteNum(24.99));

const S4c = CE.newState();
S4c.staffUnlocked.barista = true;
S4c.staff.barista.n = 1; /* working cart with starting stock */
S4c.cash = Big.fromNumber(200);
E.dirty = true;
E.tick(S4c, 1); E.tick(S4c, 1);
check('working staff are still paid full wages', S4c.rates.wages.gteNum(0.049));

const S5 = CE.newState();
S5.stats.runRevenue = Big.fromNumber(1e6);
S5.staff.barista.n = 10;
S5.cash = Big.fromNumber(1000);
for (const r in S5.resources) S5.resources[r] = 0; /* workplaces idle */
E.dirty = true;
E.tick(S5, 1); E.tick(S5, 1);
check('idle staff are sent home (no wages)', S5.rates.wages.toNumber() < 1e-9);

console.log('== Phase 1: offline balance ==');
const S6 = CE.newState();
CE.applyLegacyStart(S6);
S6.cash = Big.fromNumber(300);
S6.staffUnlocked.barista = true;
E.hire(S6, 'barista', 1);
E.dirty = true;
const sum = E.simulateOffline(S6, 8 * 3600);
check('8h offline early game never bankrupts', S6.cash.gteNum(24.99));
check('offline summary profit = revenue - expenses', sum.profit.eq(sum.revenue.sub(sum.expenses)));
check('offline operating costs scaled with activity', sum.expenses.lt(Big.fromNumber(8 * 3600 * 0.02)));

console.log('== Phase 1: first upgrade ==');
const S7 = CE.newState();
CE.applyLegacyStart(S7);
E.dirty = true;
check('paperCups available from the start', E.upgradeAvailable(S7, CE.UPGRADE_MAP.paperCups));
check('paperCups affordable early ($60)', E.buyUpgrade(S7, 'paperCups'));
E.ensureMods(S7);
check('paperCups boosts manual brewing x1.25', Math.abs(E.mods.manualMult - 1.25) < 1e-9);

console.log('== Phase 5: tab visibility ==');
const S8 = CE.newState();
E.dirty = true;
E.checkTabs(S8, false);
check('only 4 sections visible at start', Object.keys(S8.tabsUnlocked).length === 4);
check('locked sections fully hidden (no greyed entries)', !S8.tabsUnlocked.production && !S8.tabsUnlocked.statistics && !S8.tabsUnlocked.corporate);
S8.stats.cups = 100;
S8.rp = 30;
S8.staffUnlocked.barista = true;
S8.discovered.smallFarm = true;
S8.discovered.processing = true;
S8.discovered.researchLab = true;
S8.stats.revenue = Big.fromNumber(5000);
E.checkTabs(S8, false);
check('progression unlocks all earned sections', Object.keys(S8.tabsUnlocked).length === 13);
const notifCount = CE.notifications.length;
E.checkTabs(S8, false);
check('unlocks are permanent (no re-notification)', CE.notifications.length === notifCount);
const S8b = CE.deserialize(CE.serialize(S8));
check('unlocked tabs survive save/load', Object.keys(S8b.tabsUnlocked).length === 13);

console.log('== Phase 3: tutorial persistence ==');
const S9 = CE.newState();
S9.tutorial = { done: false, skipped: false, active: true, step: 3 };
const S9b = CE.deserialize(CE.serialize(S9));
check('tutorial progress survives save/load', S9b.tutorial.active === true && S9b.tutorial.step === 3);
S9.tutorial = { done: true, skipped: false, active: false, step: 6 };
check('tutorial completion survives save/load', CE.deserialize(CE.serialize(S9)).tutorial.done === true);

console.log('== Save migration v2 -> v3 ==');
const S10 = CE.newState();
S10.cash = Big.fromNumber(5e6);
S10.stats.revenue = Big.fromNumber(5e6);
S10.stats.cups = 500;
S10.biz.smallShop.regions.na = 3;
S10.staff.barista.n = 6;
S10.staffUnlocked.barista = true;
S10.upgrades.machines1 = 1;
const v2 = JSON.parse(CE.serialize(S10));
v2.version = 2;
delete v2.tabsUnlocked; delete v2.tutorial;
const S11 = CE.deserialize(JSON.stringify(v2));
check('v2 migration preserves cash & businesses', S11.cash.eq(Big.fromNumber(5e6)) && E.totalOwned(S11, 'smallShop') === 3);
check('v2 migration preserves upgrades', !!S11.upgrades.machines1);
check('v2 migration backfills earned tabs silently', !!S11.tabsUnlocked.staff && !!S11.tabsUnlocked.locations && !!S11.tabsUnlocked.statistics);
check('v2 migration does not force tutorial on existing players', S11.tutorial.done === true);
check('v2 migration bumps version', S11.version === 3);

console.log('== Prestige keeps unlocks & tutorial ==');
const S12 = CE.newState();
S12.tabsUnlocked.statistics = Date.now();
S12.tutorial.done = true;
S12.stats.runRevenue = Big.fromNumber(1e11);
E.dirty = true;
const pres = E.prestige(S12);
check('prestige keeps unlocked tabs', !!pres.state.tabsUnlocked.statistics);
check('prestige keeps tutorial completion', pres.state.tutorial.done === true);

console.log(failures === 0 ? '\nALL OVERHAUL CHECKS PASSED' : '\n' + failures + ' OVERHAUL CHECKS FAILED');
process.exit(failures === 0 ? 0 : 1);