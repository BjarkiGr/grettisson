// Shared helpers used across the game. Plain globals, no modules.
// Gameplay randomness flows through rnd() and can be made deterministic
// with setSeed() for the daily challenge. Cosmetic randomness (particles,
// camera shake) uses crand()/cpick() so visuals never disturb the seeded
// gameplay stream.
let _seededRng = null;

// xmur3 string hash -> mulberry32 PRNG. Same seed string => same sequence.
function setSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  let a = (h ^ (h >>> 16)) >>> 0;
  _seededRng = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function clearSeed() { _seededRng = null; }
function rnd() { return _seededRng ? _seededRng() : Math.random(); }

function rand(a, b) { return a + rnd() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
// Cosmetic-only randomness: never seeded.
function crand(a, b) { return a + Math.random() * (b - a); }
function crandInt(a, b) { return Math.floor(crand(a, b + 1)); }
function cpick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
// Deterministic pseudo-random from a single number (for parallax scenery).
function hash1(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }