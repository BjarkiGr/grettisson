/* Early-game pacing test: a human-speed player uses real brew sessions.
   Run: node test/pacing.js */
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
E.dirty = true;
E.brewSelect(S, 'regular');
const events = [];
const seen = {};
let failures = 0;
function check(name, cond) {
  if (cond) console.log('  ok  ' + name);
  else { failures++; console.error('FAIL  ' + name); }
}

for (let t = 0; t < 1500; t += 0.25) {
  E.tick(S, 0.25);
  /* Human-speed manual brewing: restart the pipeline whenever idle */
  if (S.brewSession && !S.brewSession.running) E.brewStartStep(S);
  /* Restock like a player */
  if (S.resources.roasted < 0.5) E.buyResource(S, 'roasted', 1);
  if (S.resources.water < 5) E.buyResource(S, 'water', 20);
  /* Hire the first barista as soon as unlocked & affordable */
  if (S.staffUnlocked.barista && S.staff.barista.n === 0 && S.cash.gteNum(300)) E.hire(S, 'barista', 1);
  /* Log first-time milestones & discoveries with game time */
  for (const id in S.milestones) if (!seen['m:' + id]) { seen['m:' + id] = true; events.push([S.time, 'milestone', id]); }
  for (const id in S.discovered) if (!seen['d:' + id]) { seen['d:' + id] = true; events.push([S.time, 'discovered', id]); }
}

console.log('First 25 minutes of human-speed play:');
for (const [t, kind, id] of events.slice(0, 24)) {
  console.log('  ' + CE.fmtTime(t).padStart(8) + '  ' + kind + ': ' + id);
}
const at = id => { const e = events.find(x => x[2] === id); return e ? e[0] : Infinity; };
check('first cup within 10s', at('firstCup') <= 10);
check('10 cups within 90s', at('sell10') <= 90);
check('25 cups within 180s', at('sell25') <= 180);
check('barista unlock ($250) within 7 min', at('rev250') <= 420);
check('first hire within 8 min', at('hire1') <= 480);
check('first shop discovered within 15 min', at('smallShop') <= 900);
check('100 cups within 12 min', at('sell100') <= 720);
check('at least 8 unlocks in first 15 min', events.filter(e => e[0] <= 900).length >= 8);
console.log(failures === 0 ? '\nPACING OK' : '\n' + failures + ' PACING CHECKS FAILED');
process.exit(failures === 0 ? 0 : 1);
