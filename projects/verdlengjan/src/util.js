// Shared helpers. Plain globals, no modules (same convention as Godzilla).
// Gameplay randomness flows through rnd() and is made deterministic with
// setSeed() for the daily puzzle. Cosmetic randomness (steam, sparkles)
// uses crand()/cpick() so visuals never disturb the seeded stream.
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
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
// Cosmetic-only randomness: never seeded.
function crand(a, b) { return a + Math.random() * (b - a); }
function cpick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
// Deterministic pseudo-random from a single number (slice decorations).
function hash1(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

// ISK formatting: 1499 -> "1.499 kr." (Icelandic thousands separator).
function formatKr(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' kr.';
}
// Accepts "1.499", "1499", "1.499 kr.", "1,499" -> 1499. NaN if not a price.
function parseKr(str) {
  const cleaned = String(str).replace(/kr\.?/gi, '').replace(/[\s.,]/g, '');
  if (!/^\d+$/.test(cleaned)) return NaN;
  return parseInt(cleaned, 10);
}

// Logarithmic guess slider: 10 kr .. 15.000 kr over 1000 steps.
// Log scale keeps low prices (the interesting ones) easy to aim at.
const SLIDER_MIN = 10, SLIDER_MAX = 15000, SLIDER_STEPS = 1000;
function sliderToPrice(v) {
  return Math.round(SLIDER_MIN * Math.pow(SLIDER_MAX / SLIDER_MIN, v / SLIDER_STEPS));
}
function priceToSlider(p) {
  return Math.round(SLIDER_STEPS * Math.log(clamp(p, SLIDER_MIN, SLIDER_MAX) / SLIDER_MIN) / Math.log(SLIDER_MAX / SLIDER_MIN));
}
