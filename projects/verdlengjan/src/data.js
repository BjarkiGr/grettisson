// Product bank, scoring tiers and the seeded daily-five picker.
// Pure logic only - no DOM access, so the smoke test can run it headless.
const Bank = { products: [], snapshotDate: null, loaded: false };

async function loadBank() {
  const res = await fetch('data/products.json');
  const data = await res.json();
  Bank.products = data.products;
  Bank.snapshotDate = data.snapshotDate;
  Bank.loaded = true;
  return Bank;
}

// Scoring tiers, best first. cm = physical length baked onto the lengja.
// Exact price = max growth (20 cm); more than 100% off = no growth at all.
const TIERS = [
  { id: 'exact',  name: 'Á nagann!',   cm: 20, emoji: '🎯', maxError: 0 },
  { id: 'close',  name: 'Mjög nálægt', cm: 16, emoji: '🟩', maxError: 0.05 },
  { id: 'near',   name: 'Nálægt',      cm: 12, emoji: '🟨', maxError: 0.15 },
  { id: 'decent', name: 'Sæmilegt',    cm: 8,  emoji: '🟧', maxError: 0.35 },
  { id: 'far',    name: 'Fjarri lagi', cm: 4,  emoji: '🟥', maxError: 1.0 },
  { id: 'miss',   name: 'Ekkert!',     cm: 0,  emoji: '⬛', maxError: Infinity },
];
function tierById(id) { return TIERS.find((t) => t.id === id) || TIERS[TIERS.length - 1]; }

// guess and price in whole ISK. Exact hit = rúsína; otherwise relative error.
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
  if (cm >= 100) return 'Meistarabakari 🏆';
  if (cm >= 75) return 'Bakari';
  if (cm >= 50) return 'Lærlingur';
  if (cm >= 25) return 'Bakarasveinn';
  return 'Aumingja bakari';
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
// category that rotates with the puzzle number. Falls back gracefully when
// a bucket is empty. Uses the current rnd() stream (seeded or not).
function pickFive(products, puzzleNumber) {
  const chosen = [];
  const used = new Set();
  function take(list) {
    while (list.length) {
      const p = list.pop();
      if (!used.has(p.sku)) { used.add(p.sku); chosen.push(p); return p; }
    }
    return null;
  }
  take(shuffled(products.filter((p) => p.price < 200)));
  take(shuffled(products.filter((p) => p.price >= 200 && p.price <= 600)));
  take(shuffled(products.filter((p) => p.price > 1000)));
  take(shuffled(products.filter((p) => p.fun)));
  const cats = [...new Set(products.map((p) => p.category))].sort();
  if (cats.length) {
    const cat = cats[((puzzleNumber % cats.length) + cats.length) % cats.length];
    take(shuffled(products.filter((p) => p.category === cat)));
  }
  const rest = shuffled(products);
  while (chosen.length < ITEMS_PER_DAY && rest.length) take(rest);
  return shuffled(chosen);
}

// Same five for everyone on a given date.
function buildDailyFive(products, dateStr, puzzleNumber) {
  setSeed('verdlaengjan:' + dateStr);
  return pickFive(products, puzzleNumber);
}
// Unlimited mode: fresh random five, never seeded.
function randomFive(products) {
  clearSeed();
  return pickFive(products, Math.floor(Math.random() * 1e9));
}
