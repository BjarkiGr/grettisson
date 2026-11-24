// Product bank, scoring tiers and the seeded daily-five picker.
// Pure logic only - no DOM access, so the smoke test can run it headless.
const Bank = { products: [], snapshotDate: null, loaded: false };

// Pure helper: which archived bank covers dateStr? null = use products.json.
// manifest = { banks: [{ file, from }] }, sorted or not. Picks the newest
// archive whose "from" date is <= dateStr. Testable headless (no fetch).
function bankForDate(manifest, dateStr, currentSnapshotDate) {
  if (!dateStr || dateStr >= currentSnapshotDate) return null;
  const entries = ((manifest && manifest.banks) || [])
    .filter((b) => b && b.file && b.from && b.from <= dateStr);
  if (!entries.length) return null;
  entries.sort((a, b) => a.from.localeCompare(b.from));
  return entries[entries.length - 1];
}

// Loads the bank that was effective on dateStr (default: today). products.json
// is always the newest snapshot; older dates fall back to data/banks/ archives
// via data/manifest.json, so a mid-day refresh never changes an ongoing puzzle.
async function loadBank(dateStr) {
  const res = await fetch('data/products.json');
  let data = await res.json();
  const want = dateStr || new Date().toISOString().slice(0, 10);
  if (want < data.snapshotDate) {
    let entry = null;
    try {
      const m = await (await fetch('data/manifest.json')).json();
      entry = bankForDate(m, want, data.snapshotDate);
    } catch (e) { /* no manifest: keep the newest bank */ }
    if (entry) {
      try { data = await (await fetch('data/' + entry.file)).json(); }
      catch (e) { /* archive missing: keep the newest bank */ }
    }
  }
  Bank.products = data.products;
  Bank.snapshotDate = data.snapshotDate;
  Bank.loaded = true;
  return Bank;
}

// Optional price history (data/price-history.json, built from bank archives).
// Missing file is fine - the reveal-phase history row just stays hidden.
const History = { data: null };
async function loadHistory() {
  try {
    const res = await fetch('data/price-history.json');
    History.data = (await res.json()).history || null;
  } catch (e) { History.data = null; }
}

// Pure: the newest recorded price strictly before snapshotDate, or null.
// points = [[date, price], ...] in any order.
function previousPrice(points, snapshotDate) {
  if (!Array.isArray(points)) return null;
  const prior = points.filter((pt) => Array.isArray(pt) && pt[0] < snapshotDate);
  if (!prior.length) return null;
  prior.sort((a, b) => a[0].localeCompare(b[0]));
  return prior[prior.length - 1];
}

// Scoring tiers, best first. cm = physical length baked onto the lengja.
// Exact price = max growth (20 cm); more than 100% off = no growth at all.
const TIERS = [
  { id: 'exact',  name: 'Rétt verð!',   cm: 20, emoji: '🎯', maxError: 0 },
  { id: 'close',  name: 'Mjög nálægt', cm: 16, emoji: '🟩', maxError: 0.05 },
  { id: 'near',   name: 'Nálægt',      cm: 12, emoji: '🟨', maxError: 0.15 },
  { id: 'decent', name: 'Sæmilegt',    cm: 8,  emoji: '🟧', maxError: 0.35 },
  { id: 'far',    name: 'Fjarri lagi', cm: 4,  emoji: '🟥', maxError: 1.0 },
  { id: 'miss',   name: 'Ekkert!',     cm: 0,  emoji: '⬛', maxError: Infinity },
];
function tierById(id) { return TIERS.find((t) => t.id === id) || TIERS[TIERS.length - 1]; }

// guess and price in whole ISK. Exact hit = best tier; otherwise relative error.
function scoreGuess(guess, price) {
  const error = Math.abs(guess - price) / price;
  const tier = guess === price
    ? TIERS[0]
    : TIERS.find((t) => t.maxError > 0 && error <= t.maxError) || TIERS[TIERS.length - 1];
  return { tierId: tier.id, cm: tier.cm, error };
}

const START_CM = 2;     // endinn á lengjunni - everyone starts with one slice
const THURSDAY_CM = 5;  // fimmtudagsbonus: vínarbrauð í kaffi!
const ITEMS_PER_DAY = 5;

function isThursday(dateStr) {
  return new Date(dateStr + 'T12:00:00').getDay() === 4;
}
function totalCm(guesses, thursdayBonus) {
  return START_CM + guesses.reduce((s, g) => s + g.cm, 0) + (thursdayBonus ? THURSDAY_CM : 0);
}
function rankFor(cm) {
  if (cm >= 100) return 'Frábært! 🏆';
  if (cm >= 75) return 'Mjög gott';
  if (cm >= 50) return 'Gott';
  if (cm >= 25) return 'Sæmilegt';
  return 'Slakt';
}

// Seeded Fisher-Yates using the current rnd() stream.
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

// Picks 5 unique products with enforced variety: one cheap anchor (<200 kr),
// one mid (200-600), one expensive (>1000), one funny wildcard, one from a
// category that rotates with the puzzle number. Prefers a fresh category for
// every slot so the daily five never feels like "five of the same group";
// falls back gracefully when a bucket or category is exhausted. Uses the
// current rnd() stream (seeded or not).
function pickFive(products, puzzleNumber) {
  const chosen = [];
  const used = new Set();
  const usedCats = new Set();
  function take(list, sameCatOk) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      if (used.has(p.sku)) continue;
      if (!sameCatOk && usedCats.has(p.category)) continue;
      list.splice(i, 1);
      used.add(p.sku); usedCats.add(p.category); chosen.push(p);
      return p;
    }
    return null;
  }
  const takeVaried = (list) => take(list, false) || take(list, true);
  takeVaried(shuffled(products.filter((p) => p.price < 200)));
  takeVaried(shuffled(products.filter((p) => p.price >= 200 && p.price <= 600)));
  takeVaried(shuffled(products.filter((p) => p.price > 1000)));
  takeVaried(shuffled(products.filter((p) => p.fun)));
  const cats = [...new Set(products.map((p) => p.category))].sort();
  if (cats.length) {
    const cat = cats[((puzzleNumber % cats.length) + cats.length) % cats.length];
    takeVaried(shuffled(products.filter((p) => p.category === cat)));
  }
  const rest = shuffled(products);
  while (chosen.length < ITEMS_PER_DAY && rest.length) {
    if (!takeVaried(rest)) break;
  }
  return shuffled(chosen);
}

// Same five for everyone on a given date.
function buildDailyFive(products, dateStr, puzzleNumber) {
  setSeed('verdlengjan:' + dateStr);
  return pickFive(products, puzzleNumber);
}
// Unlimited mode: fresh random five, never seeded.
function randomFive(products) {
  clearSeed();
  return pickFive(products, Math.floor(Math.random() * 1e9));
}
