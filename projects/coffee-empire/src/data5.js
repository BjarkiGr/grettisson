/* COFFEE EMPIRE — global milestone & unlock system.
   metric(S, H) returns current progress toward target. Rewards unlock real
   content: recipes, staff types, business discoveries, research categories,
   features, plus RP/cash bonuses. Persisted in S.milestones. */
(function (global) {
'use strict';
const CE = global.CE = global.CE || {};

const cups = (S, H) => H.cups;
const rev = S => S.stats.revenue.toNumber();
const cash = S => S.cash.toNumber();
const worth = (S, H) => H.worth.toNumber();
const staff = (S, H) => H.staff;
const biz = (S, H) => H.totalBiz;
const drinks = S => Object.keys(S.recipesUnlocked || {}).length;
const capacity = (S, H) => {
  let c = 0;
  for (const b of CE.BUSINESSES) if (b.cups) c += b.cups * (H.owned[b.id] || 0);
  return c;
};
const research = (S, H) => H.research;
const rep = S => S.brand;
const regions = (S, H) => H.regions;

CE.MILESTONES = [
  /* --- Sales (early deliberate sequence) --- */
  { id: 'firstCup', group: 'Sales', name: 'First Cup', desc: 'Manually brew and serve your very first coffee.', metric: cups, target: 1, rewards: { cash: 25, rp: 2 } },
  { id: 'sell10', group: 'Sales', name: 'Getting Regulars', desc: 'Sell 10 coffees.', metric: cups, target: 10, rewards: { recipes: ['americano'], rp: 3 } },
  { id: 'sell25', group: 'Sales', name: 'Morning Rush', desc: 'Sell 25 coffees.', metric: cups, target: 25, rewards: { recipes: ['cappuccino'], rp: 3 } },
  { id: 'sell100', group: 'Sales', name: 'Neighborhood Favorite', desc: 'Sell 100 coffees.', metric: cups, target: 100, rewards: { recipes: ['mocha', 'coldbrew'], rp: 5 } },
  { id: 'sell1000', group: 'Sales', name: 'Local Legend', desc: 'Sell 1,000 coffees.', metric: cups, target: 1000, rewards: { cash: 500, rp: 15 } },
  { id: 'sell10000', group: 'Sales', name: 'City Institution', desc: 'Sell 10,000 coffees.', metric: cups, target: 1e4, rewards: { rp: 40 } },
  { id: 'sell100000', group: 'Sales', name: 'Household Name', desc: 'Sell 100,000 coffees.', metric: cups, target: 1e5, rewards: { rp: 100 } },
  { id: 'sell1e7', group: 'Sales', name: 'A Million Mornings', desc: 'Sell 10 million coffees.', metric: cups, target: 1e7, rewards: { rp: 300 } },
  /* --- Revenue & early unlocks --- */
  { id: 'rev250', group: 'Revenue', name: 'First Barista', desc: 'Reach $250 lifetime revenue. Unlocks hiring baristas — your cart will finally run itself.', metric: rev, target: 250, rewards: { staff: ['barista'], rp: 3 } },
  { id: 'hire1', group: 'Revenue', name: 'Employer', desc: 'Hire your first employee. Unlocks the Automation research category.', metric: staff, target: 1, rewards: { cats: ['Automation'], rp: 5 } },
  { id: 'rev500', group: 'Revenue', name: 'Brick and Mortar', desc: 'Reach $500 lifetime revenue. Discover your first permanent coffee shop.', metric: rev, target: 500, rewards: { discover: ['smallShop'], recipes: ['latte'], rp: 5 } },
  { id: 'rev1000', group: 'Revenue', name: 'Shop Management', desc: 'Reach $1,000 lifetime revenue. Unlocks Shop Managers and the full café menu.', metric: rev, target: 1000, rewards: { staff: ['shopManager'], recipes: ['iced', 'flatwhite', 'macchiato'], rp: 5 } },
  { id: 'rev1200', group: 'Revenue', name: 'Industrial Workforce', desc: 'Reach $1,200 lifetime revenue. Unlocks Factory Workers.', metric: rev, target: 1200, rewards: { staff: ['factoryWorker'], rp: 5 } },
  { id: 'rev2000', group: 'Revenue', name: 'Supply Lines', desc: 'Reach $2,000 lifetime revenue. Unlocks Logistics Workers.', metric: rev, target: 2000, rewards: { staff: ['logisticsWorker'], rp: 5 } },
  { id: 'rev5000', group: 'Revenue', name: 'Getting the Word Out', desc: 'Reach $5,000 lifetime revenue. Unlocks marketing campaigns and Logistics research.', metric: rev, target: 5000, rewards: { features: ['campaigns'], cats: ['Logistics'], rp: 10 } },
  { id: 'rev12000', group: 'Revenue', name: 'On the Road', desc: 'Reach $12,000 lifetime revenue. Unlocks Drivers.', metric: rev, target: 12000, rewards: { staff: ['driver'], rp: 10 } },
  { id: 'rev40000', group: 'Revenue', name: 'R&D Department', desc: 'Reach $40,000 lifetime revenue. Unlocks Researchers.', metric: rev, target: 40000, rewards: { staff: ['researcher'], rp: 20 } },
  { id: 'rev300000', group: 'Revenue', name: 'Brand Builders', desc: 'Reach $300,000 lifetime revenue. Unlocks Marketing Specialists and Marketing research.', metric: rev, target: 300000, rewards: { staff: ['marketing'], cats: ['Marketing'], rp: 40 } },
  { id: 'rev2e11', group: 'Revenue', name: 'Corner Office', desc: 'Reach $200B lifetime revenue. Unlocks Executives and Corporate Management research.', metric: rev, target: 2e11, rewards: { staff: ['executive'], cats: ['Corporate Management'], rp: 300 } },
  { id: 'rev1e6', group: 'Revenue', name: 'Million Dollar Roast', desc: 'Reach $1M lifetime revenue.', metric: rev, target: 1e6, rewards: { cash: 5000, rp: 100 } },
  { id: 'rev1e9', group: 'Revenue', name: 'Billion Dollar Brand', desc: 'Reach $1B lifetime revenue.', metric: rev, target: 1e9, rewards: { rp: 500 } },
  { id: 'rev1e12', group: 'Revenue', name: 'Trillion Dollar Taste', desc: 'Reach $1T lifetime revenue.', metric: rev, target: 1e12, rewards: { rp: 2000 } },
  /* --- Company building --- */
  { id: 'locations2', group: 'Company', name: 'Second Location', desc: 'Own 2 retail locations. Your chain begins.', metric: (S, H) => H.catOwned.retail, target: 2, rewards: { cash: 250, rp: 10 } },
  { id: 'farm1', group: 'Company', name: 'Down on the Farm', desc: 'Own your first agricultural business.', metric: (S, H) => H.catOwned.farm, target: 1, rewards: { staff: ['farmWorker'], rp: 5 } },
  { id: 'plantation1', group: 'Company', name: 'Plantation Owner', desc: 'Own a Medium Coffee Plantation. Unlocks Agricultural Managers.', metric: (S, H) => H.owned.mediumPlantation || 0, target: 1, rewards: { staff: ['agManager'], rp: 15 } },
  { id: 'factories3', group: 'Company', name: 'Factory Floor', desc: 'Own 3 manufacturing facilities. Unlocks Factory Managers.', metric: (S, H) => H.catOwned.factory, target: 3, rewards: { staff: ['factoryManager'], rp: 15 } },
  { id: 'biz10', group: 'Company', name: 'Small Business Owner', desc: 'Own 10 businesses in total.', metric: biz, target: 10, rewards: { rp: 15 } },
  { id: 'biz50', group: 'Company', name: 'Growing Chain', desc: 'Own 50 businesses in total.', metric: biz, target: 50, rewards: { rp: 60 } },
  { id: 'biz200', group: 'Company', name: 'Conglomerate', desc: 'Own 200 businesses in total.', metric: biz, target: 200, rewards: { rp: 200 } },
  { id: 'staff10', group: 'Company', name: 'Team Leader', desc: 'Employ 10 people.', metric: staff, target: 10, rewards: { rp: 15 } },
  { id: 'staff100', group: 'Company', name: 'Middle Management', desc: 'Employ 100 people.', metric: staff, target: 100, rewards: { rp: 60 } },
  { id: 'staff1000', group: 'Company', name: 'Corporate Ladder', desc: 'Employ 1,000 people.', metric: staff, target: 1000, rewards: { rp: 250 } },
  { id: 'worth1e6', group: 'Company', name: 'Million Dollar Valuation', desc: 'Reach $1M company valuation.', metric: worth, target: 1e6, rewards: { rp: 50 } },
  { id: 'worth1e9', group: 'Company', name: 'Unicorn Roaster', desc: 'Reach $1B company valuation.', metric: worth, target: 1e9, rewards: { rp: 300 } },
  { id: 'cash1e6', group: 'Company', name: 'Cash Rich', desc: 'Hold $1M in cash at once.', metric: cash, target: 1e6, rewards: { rp: 50 } },
  { id: 'drinks6', group: 'Company', name: 'Full Menu', desc: 'Discover 6 coffee recipes.', metric: drinks, target: 6, rewards: { rp: 20 } },
  { id: 'drinksAll', group: 'Company', name: 'Master of the Menu', desc: 'Discover all 12 coffee recipes.', metric: drinks, target: 12, rewards: { rp: 100 } },
  { id: 'capacity100', group: 'Company', name: 'Serious Throughput', desc: 'Reach 100 cups/sec of retail capacity.', metric: capacity, target: 100, rewards: { rp: 30 } },
  { id: 'capacity10000', group: 'Company', name: 'Coffee Metropolis', desc: 'Reach 10,000 cups/sec of retail capacity.', metric: capacity, target: 10000, rewards: { rp: 150 } },
  /* --- Knowledge & world --- */
  { id: 'research1', group: 'Knowledge', name: 'Curious Minds', desc: 'Complete your first research project.', metric: research, target: 1, rewards: { rp: 5 } },
  { id: 'research10', group: 'Knowledge', name: 'Innovation Lab', desc: 'Complete 10 research projects.', metric: research, target: 10, rewards: { rp: 50 } },
  { id: 'researchAll', group: 'Knowledge', name: 'Omniscient Roasters', desc: 'Complete every research project.', metric: research, target: CE.RESEARCH.length, rewards: { rp: 500 } },
  { id: 'rep25', group: 'Knowledge', name: 'Known Name', desc: 'Reach 25 brand reputation. Unlocks the Seasonal Coffee recipe.', metric: rep, target: 25, rewards: { recipes: ['seasonal'], rp: 20 } },
  { id: 'rep50', group: 'Knowledge', name: 'Popular Brand', desc: 'Reach 50 brand reputation.', metric: rep, target: 50, rewards: { rp: 60 } },
  { id: 'rep75', group: 'Knowledge', name: 'Famous Brand', desc: 'Reach 75 brand reputation.', metric: rep, target: 75, rewards: { rp: 150 } },
  { id: 'regions2', group: 'Knowledge', name: 'Going International', desc: 'Operate in 2 regions.', metric: regions, target: 2, rewards: { rp: 50 } },
  { id: 'regions6', group: 'Knowledge', name: 'Every Continent', desc: 'Operate in all 6 regions.', metric: regions, target: 6, rewards: { rp: 300 } },
  { id: 'products1000', group: 'Knowledge', name: 'Factory Town', desc: 'Manufacture 1,000 packaged products.', metric: (S, H) => H.products, target: 1000, rewards: { rp: 30 } },
  { id: 'beans1000', group: 'Knowledge', name: 'Harvest Festival', desc: 'Harvest 1,000 kg of coffee cherries.', metric: (S, H) => H.beans, target: 1000, rewards: { rp: 30 } },
  { id: 'prestige1', group: 'Knowledge', name: 'Legacy Begins', desc: 'Restructure your corporation for the first time.', metric: S => S.legacy.prestiges, target: 1, rewards: { rp: 50 } }
];
CE.MILESTONE_MAP = {}; CE.MILESTONES.forEach(m => CE.MILESTONE_MAP[m.id] = m);
CE.MILESTONE_GROUPS = ['Sales', 'Revenue', 'Company', 'Knowledge'];
CE.DEFAULT_RESEARCH_CATS = ['Agriculture', 'Coffee Science', 'Manufacturing', 'Retail'];
})(typeof window !== 'undefined' ? window : globalThis);
