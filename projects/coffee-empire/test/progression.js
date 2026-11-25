/* End-to-end progression test: a simple bot plays the early game honestly.
   Run: node test/progression.js */
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

const S = CE.newState();
CE.applyLegacyStart(S);
let failures = 0;
function check(name, cond) {
  if (cond) console.log('  ok  ' + name);
  else { failures++; console.error('FAIL  ' + name); }
}

const dt = 0.25;
let actAcc = 0;
let tailRev = Big.ZERO, tailExp = Big.ZERO;
for (let t = 0; t < 2400; t += dt) {
  const r = E.tick(S, dt);
  if (t >= 2340) { tailRev = tailRev.add(r.rev); tailExp = tailExp.add(r.exp); }
  actAcc += dt;
  if (actAcc < 1) continue;
  actAcc = 0;
  /* Manual brewing like a player */
  E.brew(S, 'regular');
  E.brew(S, 'espresso');
  /* Restock ingredients; use auto-purchasing once researched */
  if (S.research.done.autoInventory) {
    for (const res of ['roasted', 'water', 'milk', 'sugar', 'cocoa', 'packaging']) S.supply[res].auto = true;
  } else {
    if (S.resources.roasted < 5) E.buyResource(S, 'roasted', 20);
    if (S.resources.water < 50) E.buyResource(S, 'water', 200);
    if (S.resources.milk < 10) E.buyResource(S, 'milk', 40);
  }
  /* Hire when understaffed, unlocked and affordable */
  E.ensureMods(S);
  for (const type in CE.STAFF) {
    if (!S.staffUnlocked[type]) continue;
    const need = Math.ceil(E.needs[type]);
    if (S.staff[type].n < need) {
      const cost = E.hireCost(S, type, 1);
      if (S.cash.gt(cost.mulNum(2))) E.hire(S, type, 1);
    }
  }
  /* Buy cheapest affordable unlocked business (keep a cash buffer) */
  const options = CE.BUSINESSES.filter(b => E.bizUnlocked(S, b))
    .map(b => ({ b, cost: CE.costAt(b.cost, b.g, E.totalOwned(S, b.id)) }))
    .sort((a, b2) => a.cost.cmp(b2.cost));
  for (const o of options) {
    if (S.cash.gt(o.cost.mulNum(3))) { E.buyBiz(S, o.b.id, 1); break; }
  }
  /* Research cheapest available in unlocked categories */
  const research = CE.RESEARCH.filter(r => !S.research.done[r.id] &&
    S.researchCatsUnlocked.indexOf(r.cat) >= 0 &&
    !(S.research.active && S.research.active.id === r.id) &&
    S.research.queue.indexOf(r.id) < 0 && r.req.every(q => S.research.done[q]))
    .sort((a, b) => a.cost - b.cost)[0];
  if (research && S.rp >= research.cost) E.startResearch(S, research.id);
  /* Buy cheap upgrades */
  const up = CE.UPGRADES.filter(u => E.upgradeAvailable(S, u)).sort((a, b) => a.cost - b.cost)[0];
  if (up && S.cash.gt(Big.fromNumber(up.cost * 5))) E.buyUpgrade(S, up.id);
}

console.log('After 40 minutes of honest play:');
console.log('  cash:', CE.fmtMoney(S.cash));
console.log('  lifetime revenue:', CE.fmtMoney(S.stats.revenue));
console.log('  net worth:', CE.fmtMoney(E.valuation(S)));
console.log('  cups sold:', Math.round(S.stats.cups));
console.log('  businesses:', CE.BUSINESSES.reduce((a, b) => a + E.totalOwned(S, b.id), 0));
console.log('  employees:', Object.values(S.staff).reduce((a, s) => a + s.n, 0));
console.log('  research done:', Object.keys(S.research.done).length);
console.log('  achievements:', Object.keys(S.achievements).length);
console.log('  upgrades:', Object.keys(S.upgrades).length);

check('revenue progressed past $5K', S.stats.revenue.gteNum(5000));
check('first permanent shop owned', E.totalOwned(S, 'smallShop') >= 1);
check('production chain started', E.totalOwned(S, 'smallFarm') >= 1 || E.totalOwned(S, 'processing') >= 1);
check('research completed', Object.keys(S.research.done).length >= 1);
check('employees hired', Object.values(S.staff).reduce((a, s) => a + s.n, 0) >= 3);
check('achievements unlocked', Object.keys(S.achievements).length >= 4);
check('profitable over final minute', tailRev.gt(tailExp));
check('cash never negative', S.cash.m >= 0);
console.log(failures === 0 ? '\nPROGRESSION OK' : '\n' + failures + ' PROGRESSION CHECKS FAILED');
process.exit(failures === 0 ? 0 : 1);
