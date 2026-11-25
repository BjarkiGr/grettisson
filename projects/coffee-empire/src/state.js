/* COFFEE EMPIRE — single authoritative game state + persistence. */
(function (global) {
'use strict';
const CE = global.CE = global.CE || {};
const Big = CE.Big;
CE.SAVE_KEY = 'coffeeEmpireSave_v1'; /* key kept for compatibility with existing saves */
CE.SAVE_VERSION = 2;

CE.newState = function () {
  const S = {
    version: CE.SAVE_VERSION,
    createdAt: Date.now(), runStart: Date.now(), lastSaved: Date.now(),
    time: 0, cash: Big.fromNumber(100), rp: 0, brand: 5,
    resources: {}, supply: {}, biz: {}, staff: {},
    upgrades: {}, repeatables: {},
    research: { done: {}, active: null, queue: [] },
    prices: {}, recipes: {},
    markets: {}, events: { active: [], timer: 120, log: [] },
    competitors: CE.COMPETITORS.map(c => ({ id: c.id, val: Big.fromNumber(c.val), rev: c.rev, acquired: false })),
    acquisitions: {}, subsidiaries: [], campaigns: [],
    regions: { na: { unlocked: true } }, selectedRegion: 'na',
    achievements: {},
    /* v2: discovery / milestone / gradual-automation progression */
    discovered: { cart: true },
    milestones: {},
    staffUnlocked: {},
    recipesUnlocked: { regular: true, espresso: true },
    researchCatsUnlocked: (CE.DEFAULT_RESEARCH_CATS || ['Agriculture', 'Coffee Science', 'Manufacturing', 'Retail']).slice(),
    features: {},
    brewSession: null,
    legacy: { points: 0, prestiges: 0, upgrades: {}, lifetimeEarned: 0 },
    stats: {
      revenue: Big.ZERO, expenses: Big.ZERO, cogs: Big.ZERO, opex: Big.ZERO, wages: Big.ZERO,
      runRevenue: Big.ZERO, cups: 0, beans: 0, products: 0, customers: 0, clicks: 0,
      acquisitions: 0, events: 0, playtime: 0, bestRps: Big.ZERO, bestWorth: Big.ZERO,
      offlineCollects: 0, nightBrew: false
    },
    history: [], marketHistory: {},
    rates: { rev: Big.ZERO, exp: Big.ZERO, profit: Big.ZERO, cogs: Big.ZERO, opex: Big.ZERO, wages: Big.ZERO },
    settings: { sound: true, music: false, animations: true, fmt: 'short', autosave: 30, offline: true, volume: 70 },
    ui: { section: 'overview', buyQty: 1 }
  };
  for (const id in CE.RESOURCES) {
    S.resources[id] = 0;
    S.supply[id] = { auto: false, min: 0.2, max: 0.9, supplier: 'balanced' };
  }
  for (const b of CE.BUSINESSES) S.biz[b.id] = { regions: {}, lifetime: Big.ZERO, util: 1, bottleneck: '' };
  for (const t in CE.STAFF) S.staff[t] = { n: 0, xp: 0 };
  for (const d in CE.DRINKS) S.prices[d] = 1;
  for (const c in CE.COMMODITIES) { S.markets[c] = { factor: 1, prev: 1 }; S.marketHistory[c] = [1]; }
  /* Starting kit: one cart, one basic machine, small inventory. */
  S.biz.cart.regions.na = 1;
  S.resources.roasted = 1; S.resources.milk = 4; S.resources.sugar = 1; S.resources.water = 20;
  return S;
};

/* Apply Legacy bonuses at the start of a run (new game or prestige). */
CE.applyLegacyStart = function (S) {
  const L = S.legacy.upgrades;
  const cap = L.lg_capital || 0;
  S.cash = Big.fromNumber(100 * Math.pow(10, cap));
  S.brand = 5 + 10 * (L.lg_reputation || 0);
  S.rp = 50 * (L.lg_rp || 0);
  const extraCarts = L.lg_equipment || 0;
  if (extraCarts > 0) S.biz.cart.regions.na = (S.biz.cart.regions.na || 0) + extraCarts;
  S.runStart = Date.now();
  S.time = 0;
  S.stats.runRevenue = Big.ZERO;
  return S;
};

/* ---------- Persistence ---------- */
CE.serialize = function (S) { S.lastSaved = Date.now(); return JSON.stringify(S); };
CE.deserialize = function (json) {
  const raw = JSON.parse(json, CE.bigReviver);
  if (!raw || typeof raw.version !== 'number' || raw.version > CE.SAVE_VERSION) throw new Error('Incompatible save version');
  const fresh = CE.newState();
  /* Merge onto fresh defaults so new fields never break old saves. */
  const S = Object.assign(fresh, raw);
  S.stats = Object.assign(fresh.stats, raw.stats || {});
  S.settings = Object.assign(fresh.settings, raw.settings || {});
  S.legacy = Object.assign(fresh.legacy, raw.legacy || {});
  S.research = Object.assign(fresh.research, raw.research || {});
  S.events = Object.assign(fresh.events, raw.events || {});
  for (const id in CE.RESOURCES) {
    if (typeof S.resources[id] !== 'number') S.resources[id] = 0;
    S.supply[id] = Object.assign({ auto: false, min: 0.2, max: 0.9, supplier: 'balanced' }, S.supply[id] || {});
  }
  for (const b of CE.BUSINESSES) S.biz[b.id] = Object.assign({ regions: {}, lifetime: Big.ZERO, util: 1, bottleneck: '' }, S.biz[b.id] || {});
  for (const t in CE.STAFF) S.staff[t] = Object.assign({ n: 0, xp: 0 }, S.staff[t] || {});
  S.cash = Big.from(S.cash);
  if (raw.version < 2) CE.migrateV1(S);
  S.version = CE.SAVE_VERSION;
  return S;
};

/* Legacy-save conversion: preserve ALL existing progression, initialize the
   new discovery/milestone/automation fields with full legacy visibility. */
CE.migrateV1 = function (S) {
  for (const t in CE.STAFF) S.staffUnlocked[t] = true;
  for (const d in CE.DRINKS) S.recipesUnlocked[d] = true;
  S.researchCatsUnlocked = CE.RESEARCH_CATS.slice();
  S.features.campaigns = true;
  for (const b of CE.BUSINESSES) {
    const owned = Object.values(S.biz[b.id].regions).reduce((a, n) => a + n, 0);
    if (owned > 0 || (CE.Engine && CE.Engine.bizUnlocked(S, b))) S.discovered[b.id] = true;
  }
  /* Mark already-achieved milestones complete silently (no duplicate rewards). */
  if (CE.Engine && CE.Engine.backfillMilestones) CE.Engine.backfillMilestones(S);
};
CE.loadWarning = null;
CE.save = function (S) {
  try {
    /* Keep the previous good save as a recovery backup. */
    const prev = localStorage.getItem(CE.SAVE_KEY);
    if (prev) localStorage.setItem(CE.SAVE_KEY + '_backup', prev);
    localStorage.setItem(CE.SAVE_KEY, CE.serialize(S));
    return true;
  } catch (e) { return false; }
};
CE.load = function () {
  CE.loadWarning = null;
  const attempts = [CE.SAVE_KEY, CE.SAVE_KEY + '_backup'];
  for (let i = 0; i < attempts.length; i++) {
    try {
      const json = localStorage.getItem(attempts[i]);
      if (!json) continue;
      const S = CE.deserialize(json);
      if (i > 0) CE.loadWarning = 'Main save was corrupted — recovered from backup.';
      return S;
    } catch (e) { /* try next */ }
  }
  if (localStorage.getItem(CE.SAVE_KEY)) CE.loadWarning = 'Save could not be read — starting fresh. The old data was left untouched.';
  return null;
};
/* Export/import as plain JSON (Base64 accepted on import for older exports). */
CE.exportSave = function (S) { return CE.serialize(S); };
CE.importSave = function (str) {
  str = str.trim();
  let json = str;
  if (str[0] !== '{') {
    try { json = decodeURIComponent(escape(atob(str))); }
    catch (e) { throw new Error('Not a valid save'); }
  }
  return CE.deserialize(json);
};
CE.wipeSave = function () {
  try {
    localStorage.removeItem(CE.SAVE_KEY);
    localStorage.removeItem(CE.SAVE_KEY + '_backup');
  } catch (e) {}
};
})(typeof window !== 'undefined' ? window : globalThis);
