/* COFFEE EMPIRE — achievements and Legacy (prestige) upgrades. */
(function (global) {
'use strict';
const CE = global.CE = global.CE || {};

/* ---------- Achievements ----------
   cond(S, H) uses state + helper snapshot. Rewards: Research Points.
   Each unlocked achievement also grants +1% global revenue (see engine). */
CE.ACHIEVEMENTS = [
  { id: 'firstCup', name: 'First Cup', desc: 'Sell your first coffee.', cond: (S, H) => H.cups >= 1, rp: 2 },
  { id: 'firstEmployee', name: 'First Employee', desc: 'Hire a barista.', cond: (S, H) => H.staff >= 1, rp: 3 },
  { id: 'team10', name: 'Growing Team', desc: 'Employ 10 people.', cond: (S, H) => H.staff >= 10, rp: 5 },
  { id: 'team100', name: 'Middle Management', desc: 'Employ 100 people.', cond: (S, H) => H.staff >= 100, rp: 20 },
  { id: 'team1000', name: 'Corporate Ladder', desc: 'Employ 1,000 people.', cond: (S, H) => H.staff >= 1000, rp: 100 },
  { id: 'customers1k', name: 'Local Favorite', desc: 'Serve 1,000 customers.', cond: (S, H) => H.cups >= 1000, rp: 5 },
  { id: 'customers100k', name: 'City Institution', desc: 'Serve 100,000 customers.', cond: (S, H) => H.cups >= 1e5, rp: 25 },
  { id: 'customers1e7', name: 'Household Name', desc: 'Serve 10 million customers.', cond: (S, H) => H.cups >= 1e7, rp: 100 },
  { id: 'cups1e9', name: 'A Billion Cups', desc: 'Serve one billion cups of coffee.', cond: (S, H) => H.cups >= 1e9, rp: 500 },
  { id: 'firstFarm', name: 'Coffee Farmer', desc: 'Purchase your first farm.', cond: (S, H) => H.catOwned.farm >= 1, rp: 5 },
  { id: 'firstRoast', name: 'Industrialist', desc: 'Open a roasting facility.', cond: (S, H) => H.owned.roastery >= 1 || H.owned.industrialRoast >= 1, rp: 10 },
  { id: 'vertical', name: 'Vertical Integration', desc: 'Own the complete chain: farm, processing, roastery, grinding, packaging, warehouse and retail.',
    cond: (S, H) => H.catOwned.farm >= 1 && H.owned.processing >= 1 && H.owned.roastery >= 1 && H.owned.groundFactory >= 1 && H.owned.packagingFactory >= 1 && H.owned.localWarehouse >= 1 && H.catOwned.retail >= 1, rp: 50 },
  { id: 'millionaire', name: 'Millionaire', desc: 'Reach $1 million in cash.', cond: (S) => S.cash.gteNum(1e6), rp: 15 },
  { id: 'billionaire', name: 'Billionaire', desc: 'Reach $1 billion in cash.', cond: (S) => S.cash.gteNum(1e9), rp: 100 },
  { id: 'trillionaire', name: 'Coffee Mogul', desc: 'Reach $1 trillion in cash.', cond: (S) => S.cash.gteNum(1e12), rp: 500 },
  { id: 'quadrillionaire', name: 'Coffee Emperor', desc: 'Reach $1 quadrillion in cash.', cond: (S) => S.cash.gteNum(1e15), rp: 2000 },
  { id: 'globalPresence', name: 'Global Presence', desc: 'Operate in every region.', cond: (S, H) => H.regions >= 6, rp: 300 },
  { id: 'marketLeader', name: 'Market Leader', desc: 'Reach 25% global market share.', cond: (S, H) => H.share >= 0.25, rp: 250 },
  { id: 'monopoly', name: 'Coffee Monopoly', desc: 'Reach 50% global market share.', cond: (S, H) => H.share >= 0.5, rp: 1000 },
  { id: 'worldLargest', name: "World's Largest Coffee Corporation", desc: 'Own the Global Coffee Corporation and lead the market.', cond: (S, H) => H.owned.globalCorp >= 1 && H.share >= 0.5, rp: 5000 },
  { id: 'cart10', name: 'Cartel of Carts', desc: 'Own 10 coffee carts.', cond: (S, H) => H.owned.cart >= 10, rp: 5 },
  { id: 'biz100', name: 'Portfolio Manager', desc: 'Own 100 businesses in total.', cond: (S, H) => H.totalBiz >= 100, rp: 30 },
  { id: 'biz1000', name: 'Conglomerate', desc: 'Own 1,000 businesses in total.', cond: (S, H) => H.totalBiz >= 1000, rp: 200 },
  { id: 'diversified', name: 'Diversified', desc: 'Own 20 different business types.', cond: (S, H) => H.typesOwned >= 20, rp: 100 },
  { id: 'fullCatalog', name: 'Full Catalog', desc: 'Own all 48 business types.', cond: (S, H) => H.typesOwned >= 48, rp: 2500 },
  { id: 'upgrades10', name: 'Continuous Improvement', desc: 'Purchase 10 upgrades.', cond: (S, H) => H.upgrades >= 10, rp: 10 },
  { id: 'upgrades100', name: 'Optimization Obsession', desc: 'Purchase 100 upgrades.', cond: (S, H) => H.upgrades >= 100, rp: 150 },
  { id: 'research10', name: 'Curious Minds', desc: 'Complete 10 research projects.', cond: (S, H) => H.research >= 10, rp: 30 },
  { id: 'researchAll', name: 'Omniscient Roasters', desc: 'Complete every research project.', cond: (S, H) => H.research >= CE.RESEARCH.length, rp: 3000 },
  { id: 'beans1e6', name: 'Bean Baron', desc: 'Harvest 1,000,000 kg of coffee cherries.', cond: (S, H) => H.beans >= 1e6, rp: 100 },
  { id: 'products1e6', name: 'Factory Town', desc: 'Manufacture 1,000,000 packaged products.', cond: (S, H) => H.products >= 1e6, rp: 100 },
  { id: 'prestige1', name: 'Legacy Begins', desc: 'Restructure your corporation for the first time.', cond: (S) => S.legacy.prestiges >= 1, rp: 0 },
  { id: 'prestige5', name: 'Serial Founder', desc: 'Restructure your corporation 5 times.', cond: (S) => S.legacy.prestiges >= 5, rp: 0 },
  { id: 'lp100', name: 'Old Money', desc: 'Hold 100 Legacy Points.', cond: (S) => S.legacy.points >= 100, rp: 0 },
  { id: 'acquire1', name: 'Hostile Takeover', desc: 'Complete your first acquisition.', cond: (S) => S.stats.acquisitions >= 1, rp: 50 },
  { id: 'acquire5', name: 'Roll-up Strategy', desc: 'Complete 5 acquisitions.', cond: (S) => S.stats.acquisitions >= 5, rp: 200 },
  { id: 'allRivals', name: 'No Competition', desc: 'Acquire every AI competitor.', cond: (S) => S.competitors.every(c => c.acquired), rp: 1500 },
  { id: 'events10', name: 'Weathered Storms', desc: 'Experience 10 economic events.', cond: (S) => S.stats.events >= 10, rp: 25 },
  /* Hidden achievements */
  { id: 'click100', name: 'Hands-On Founder', desc: 'Manually brew 100 times.', hidden: true, cond: (S) => S.stats.clicks >= 100, rp: 10 },
  { id: 'click1000', name: 'Barista Hands', desc: 'Manually brew 1,000 times.', hidden: true, cond: (S) => S.stats.clicks >= 1000, rp: 50 },
  { id: 'maxPrice', name: 'Luxury Tax', desc: 'Price a product at 200% or more.', hidden: true, cond: (S) => Object.values(S.prices).some(p => p >= 2), rp: 10 },
  { id: 'leanTimes', name: 'Lean Times', desc: 'Run out of cash while owning 5+ businesses.', hidden: true, cond: (S, H) => S.cash.lt(CE.Big.ONE) && H.totalBiz >= 5, rp: 10 },
  { id: 'nightOwl', name: 'Night Owl', desc: 'Brew coffee between 2 and 4 AM.', hidden: true, cond: (S) => S.stats.nightBrew, rp: 10 },
  { id: 'speedrun', name: 'Espresso Express', desc: 'Reach $1M net worth within 30 minutes of a run.', hidden: true, cond: (S, H) => H.worth.gteNum(1e6) && (Date.now() - S.runStart) < 30 * 60 * 1000, rp: 50 },
  { id: 'offlineReturn', name: 'While You Were Away', desc: 'Collect offline earnings.', hidden: true, cond: (S) => S.stats.offlineCollects >= 1, rp: 10 }
];
CE.ACHIEVEMENT_MAP = {}; CE.ACHIEVEMENTS.forEach(a => CE.ACHIEVEMENT_MAP[a.id] = a);

/* ---------- Legacy (prestige) upgrades ---------- */
CE.LEGACY_UPGRADES = [
  { id: 'lg_capital', name: 'Trust Fund', desc: 'Starting capital x10 per level.', baseCost: 1, costMult: 3, max: 6 },
  { id: 'lg_production', name: 'Family Recipes', desc: '+25% all production per level.', baseCost: 1, costMult: 1.6, max: 20 },
  { id: 'lg_revenue', name: 'Inherited Brand', desc: '+20% all revenue per level.', baseCost: 1, costMult: 1.6, max: 20 },
  { id: 'lg_opex', name: 'Old Connections', desc: 'Operating costs x0.95 per level.', baseCost: 2, costMult: 1.8, max: 10 },
  { id: 'lg_offline', name: 'Night Shift Culture', desc: '+6h offline cap and +10% offline efficiency per level.', baseCost: 2, costMult: 1.7, max: 8 },
  { id: 'lg_research', name: 'Institutional Knowledge', desc: 'Research 25% faster per level.', baseCost: 1, costMult: 1.6, max: 10 },
  { id: 'lg_equipment', name: 'Heirloom Equipment', desc: 'Start with +1 cart and x2 manual brewing per level.', baseCost: 2, costMult: 2.2, max: 5 },
  { id: 'lg_reputation', name: 'Good Name', desc: '+10 starting reputation per level.', baseCost: 1, costMult: 1.8, max: 5 },
  { id: 'lg_rp', name: 'Family Library', desc: 'Start each run with +50 Research Points per level.', baseCost: 1, costMult: 1.7, max: 5 },
  { id: 'lg_earn', name: 'Compounding Legacy', desc: '+10% Legacy Point gain per level.', baseCost: 3, costMult: 2, max: 10 }
];
CE.LEGACY_MAP = {}; CE.LEGACY_UPGRADES.forEach(u => CE.LEGACY_MAP[u.id] = u);

/* Progress fractions (0..1) shown on achievement cards. */
CE.ACH_PROGRESS = {
  firstCup: (S, H) => H.cups,
  customers1k: (S, H) => H.cups / 1000,
  customers100k: (S, H) => H.cups / 1e5,
  customers1e7: (S, H) => H.cups / 1e7,
  cups1e9: (S, H) => H.cups / 1e9,
  firstEmployee: (S, H) => H.staff,
  team10: (S, H) => H.staff / 10,
  team100: (S, H) => H.staff / 100,
  team1000: (S, H) => H.staff / 1000,
  firstFarm: (S, H) => H.catOwned.farm,
  firstRoast: (S, H) => H.owned.roastery + H.owned.industrialRoast,
  millionaire: (S) => S.cash.toNumber() / 1e6,
  billionaire: (S) => S.cash.toNumber() / 1e9,
  trillionaire: (S) => S.cash.toNumber() / 1e12,
  quadrillionaire: (S) => S.cash.toNumber() / 1e15,
  globalPresence: (S, H) => H.regions / 6,
  marketLeader: (S, H) => H.share / 0.25,
  monopoly: (S, H) => H.share / 0.5,
  cart10: (S, H) => H.owned.cart / 10,
  biz100: (S, H) => H.totalBiz / 100,
  biz1000: (S, H) => H.totalBiz / 1000,
  diversified: (S, H) => H.typesOwned / 20,
  fullCatalog: (S, H) => H.typesOwned / 48,
  upgrades10: (S, H) => H.upgrades / 10,
  upgrades100: (S, H) => H.upgrades / 100,
  research10: (S, H) => H.research / 10,
  researchAll: (S, H) => H.research / CE.RESEARCH.length,
  beans1e6: (S, H) => H.beans / 1e6,
  products1e6: (S, H) => H.products / 1e6,
  prestige1: (S) => S.legacy.prestiges,
  prestige5: (S) => S.legacy.prestiges / 5,
  lp100: (S) => S.legacy.points / 100,
  acquire1: (S) => S.stats.acquisitions,
  acquire5: (S) => S.stats.acquisitions / 5,
  events10: (S) => S.stats.events / 10
};
})(typeof window !== 'undefined' ? window : globalThis);
