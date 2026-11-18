// Headless smoke test: stubs DOM/canvas/storage, loads the game scripts in
// a vm context, then simulates gameplay: auto-walk, brake, jump, beam,
// smash, swim, daily finish + share, and seeded-layout determinism.
// Run with: node test/smoke.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = [
  'util', 'input', 'audio',
  'entities/particle', 'entities/building', 'entities/boat', 'entities/godzilla',
  'world', 'daily', 'game', 'main',
];

const listeners = {};
let simTime = 0;
let rafCb = null;

// Canvas 2D context stub: every method is a no-op, every property settable.
const gradient = { addColorStop() {} };
const ctxStub = new Proxy({}, {
  get(t, prop) {
    if (prop === 'measureText') return () => ({ width: 10 });
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
    if (typeof prop !== 'string') return undefined;
    if (!(prop in t)) t[prop] = function () {};
    return t[prop];
  },
  set(t, prop, v) { t[prop] = v; return true; },
});

const canvas = { width: 1280, height: 720, getContext: () => ctxStub };

// localStorage + clipboard stubs
const store = {};
let clipboardText = null;
const sandbox = {
  console, Math, JSON,
  performance: { now: () => simTime },
  window: {
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
  },
  document: { getElementById: () => canvas },
  requestAnimationFrame: (fn) => { rafCb = fn; },
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  },
  navigator: { clipboard: { writeText: (t) => { clipboardText = t; return Promise.resolve(); } } },
};
vm.createContext(sandbox);

for (const f of files) {
  const p = path.join(__dirname, '..', 'src', f + '.js');
  vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: f + '.js' });
}

function key(k, down = true) {
  for (const fn of listeners[down ? 'keydown' : 'keyup'] || []) {
    fn({ key: k, preventDefault() {} });
  }
}
function frame(ms = 16.7) {
  simTime += ms;
  const cb = rafCb;
  rafCb = null;
  if (!cb) throw new Error('requestAnimationFrame was not re-armed');
  cb(simTime);
}
function evalIn(expr) { return vm.runInContext(expr, sandbox); }

let failures = 0;
function check(name, cond) {
  if (cond) { console.log('PASS  ' + name); }
  else { failures++; console.log('FAIL  ' + name); }
}
// --- boot & title screen ---
frame();
check('boots to title screen', evalIn('game.state') === 'title');
check('city pre-generated', evalIn('game.world.buildings.length') > 3);

// --- start daily ---
key('Enter'); frame(); key('Enter', false);
check('ENTER starts the daily', evalIn('game.state') === 'playing' && evalIn('game.mode') === 'daily');

// --- auto-walk right until blocked by first building (no keys held) ---
for (let i = 0; i < 240; i++) frame();
const xBlocked = evalIn('game.godzilla.x');
const firstLeft = evalIn('game.world.buildings.find(b => b.solid).left');
check('auto-walk advanced (' + Math.round(xBlocked) + ')', xBlocked > 300);
check('intact building blocks movement', Math.abs(firstLeft - xBlocked - 45) < 2);

// --- brake holds position ---
key('ArrowLeft');
for (let i = 0; i < 60; i++) frame();
check('brake stops auto-walk', Math.abs(evalIn('game.godzilla.x') - xBlocked) < 0.01);
key('ArrowLeft', false);

// --- jump: airborne then landed ---
key('ArrowUp'); frame(); key('ArrowUp', false);
for (let i = 0; i < 10; i++) frame();
check('jump goes airborne', evalIn('game.godzilla.y') > 50);
for (let i = 0; i < 80; i++) frame();
check('jump lands', evalIn('game.godzilla.y') === 0 && evalIn('game.godzilla.state') !== 'jumping');

// --- beam: drains energy, ticks damage ---
key('f');
for (let i = 0; i < 90; i++) frame();
key('f', false);
check('beam fired ticks (' + evalIn('game.beamTicks') + ')', evalIn('game.beamTicks') > 5);
check('beam drained energy', evalIn('game.godzilla.energy') < 95);
frame();
check('beam released', evalIn('game.godzilla.beamOn') === false);

// --- smash everything for ~50 simulated seconds (auto-walk + attacks) ---
let roared = false;
for (let i = 0; i < 3000; i++) {
  if (i % 20 === 0) { key(' '); frame(); key(' ', false); }
  else frame();
  if (i === 600 && !roared) { key('r'); frame(); key('r', false); roared = true; }
}
const score = evalIn('game.score');
const smashed = evalIn('game.smashed');
const gx = evalIn('game.godzilla.x');
check('score accumulated (' + score + ')', score > 0);
check('buildings destroyed (' + smashed + ')', smashed >= 5);
check('godzilla advanced through city (x=' + Math.round(gx) + ')', gx > 2000);
check('position is finite', Number.isFinite(gx));
check('particles cleaned up (' + evalIn('game.particles.list.length') + ' alive)', evalIn('game.particles.list.length') < 400);
check('building list culled', evalIn('game.world.buildings.length') < 40);
check('roar fired without error', roared);

// --- swim section: teleport into the first strait ---
evalIn('game.godzilla.x = 5600; game.cam.x = 5200; game.godzilla.swimDepth = 0;');
for (let i = 0; i < 30; i++) frame();
check('swimming state in water', evalIn('game.godzilla.state') === 'swimming');
check('no buildings in water', evalIn('game.world.buildings.filter(b => game.world.isWater(b.x + b.w / 2)).length') === 0);
check('boats spawned in water (' + evalIn('game.world.boats.length') + ')', evalIn('game.world.boats.length') > 0);
key(' '); frame(); key(' ', false);
check('swipe disabled while swimming', evalIn('game.godzilla.state') === 'swimming');

// --- dive and surface ---
key('ArrowDown');
for (let i = 0; i < 90; i++) frame();
key('ArrowDown', false);
check('dive increases depth (' + Math.round(evalIn('game.godzilla.swimDepth')) + ')', evalIn('game.godzilla.swimDepth') > 100);
key('ArrowUp');
for (let i = 0; i < 90; i++) frame();
key('ArrowUp', false);
check('surface reduces depth', evalIn('game.godzilla.swimDepth') < 40);
// --- daily determinism: same date seed => identical layout ---
function layout(seed) {
  return evalIn(`(function () {
    setSeed('${seed}');
    const w = new World();
    const out = [];
    for (let cam = 0; cam < 28000; cam += 1000) {
      w.update(cam, 1280);
      for (const b of w.buildings) out.push([b.x, b.w, b.h, b.maxHp, b.color]);
      for (const bt of w.boats) out.push(['boat', bt.x, bt.hp]);
    }
    return JSON.stringify(out);
  })()`);
}
const layA = layout('2026-11-18');
const layB = layout('2026-11-18');
const layC = layout('2026-11-19');
check('same seed => identical city + boats', layA === layB);
check('different seed => different city', layA !== layC);

// --- daily finish: teleport near the line, clear the path, cross it ---
evalIn(`game.godzilla.x = game.finishX - 5; game.cam.x = game.finishX - 700;
  game.world.nextX = game.finishX + 800;
  game.world.buildings.forEach((bl) => { if (bl.right > game.finishX - 400) bl.state = 'rubble'; });`);
for (let i = 0; i < 5; i++) frame();
check('crossing finish shows results', evalIn('game.state') === 'results');
check('result recorded for today', evalIn('Daily.playedToday()') === true);
check('streak started', evalIn('Daily.load().streak') === 1);
check('result has score + segments', evalIn('game.result.score > 0 && game.result.segments.length === 7'));

// --- share copy ---
key('c'); frame(); key('c', false);
check('share text copied', clipboardText !== null && clipboardText.includes('Daily Rampage #'));
check('share text has segment grid', clipboardText.includes('🌊') || clipboardText.includes('🚤'));

// --- unlimited mode + escape back to title ---
key('u'); frame(); key('u', false);
check('U starts unlimited', evalIn('game.state') === 'playing' && evalIn('game.mode') === 'unlimited');
key('Escape'); frame(); key('Escape', false);
check('ESC ends run to title', evalIn('game.state') === 'title');
check('unlimited best saved', evalIn('Daily.load().bestUnlimited') >= 0);

// --- daily already played: ENTER views the result instead of replaying ---
key('Enter'); frame(); key('Enter', false);
check('played daily shows results, not a new run', evalIn('game.state') === 'results');
key('Escape'); frame(); key('Escape', false);

// --- idle stability while braking in unlimited ---
key('u'); frame(); key('u', false);
key('ArrowLeft');
for (let i = 0; i < 120; i++) frame();
check('idle frames stable while braking', evalIn('game.godzilla.state') === 'idle');
key('ArrowLeft', false);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : '\n' + failures + ' CHECK(S) FAILED');
process.exit(failures === 0 ? 0 : 1);