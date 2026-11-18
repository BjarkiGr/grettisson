// Headless smoke test: stubs DOM/canvas, loads the game scripts in a vm
// context, then simulates ~55s of gameplay: start, walk, smash, roar.
// Run with: node test/smoke.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = [
  'util', 'input', 'audio',
  'entities/particle', 'entities/building', 'entities/godzilla',
  'world', 'game', 'main',
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

// --- start game ---
key('Enter'); frame(); key('Enter', false);
check('ENTER starts the game', evalIn('game.state') === 'playing');

// --- walk right until blocked by first building ---
key('ArrowRight');
for (let i = 0; i < 240; i++) frame();
const xBlocked = evalIn('game.godzilla.x');
const firstLeft = evalIn('game.world.buildings.find(b => b.solid).left');
check('godzilla walked right', xBlocked > 300);
check('intact building blocks movement', Math.abs(firstLeft - xBlocked - 45) < 2);

// --- smash everything for ~50 simulated seconds ---
let roared = false;
for (let i = 0; i < 3000; i++) {
  if (i % 20 === 0) { key(' '); frame(); key(' ', false); }
  else frame();
  if (i === 600 && !roared) { key('r'); frame(); key('r', false); roared = true; }
}
key('ArrowRight', false);

const score = evalIn('game.score');
const smashed = evalIn('game.smashed');
const gx = evalIn('game.godzilla.x');
const rubble = evalIn("game.world.buildings.filter(b => b.state === 'rubble').length");
const maxComboSeen = evalIn('game.combo');
const particleCount = evalIn('game.particles.list.length');

check('score accumulated (' + score + ')', score > 0);
check('buildings destroyed (' + smashed + ')', smashed >= 5);
check('rubble state reached (' + rubble + ' on screen)', rubble >= 1);
check('godzilla advanced through city (x=' + Math.round(gx) + ')', gx > 2000);
check('position is finite', Number.isFinite(gx));
check('particles cleaned up (' + particleCount + ' alive)', particleCount < 400);
check('building list culled (' + evalIn('game.world.buildings.length') + ' alive)', evalIn('game.world.buildings.length') < 40);
check('roar fired without error', roared);

// --- walk left over rubble ---
key('ArrowLeft');
for (let i = 0; i < 120; i++) frame();
key('ArrowLeft', false);
check('can walk back left over rubble', evalIn('game.godzilla.x') < gx);

// --- idle frames keep running cleanly ---
for (let i = 0; i < 120; i++) frame();
check('idle frames stable', evalIn('game.godzilla.state') === 'idle');

console.log(failures === 0 ? '\nALL CHECKS PASSED' : '\n' + failures + ' CHECK(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
