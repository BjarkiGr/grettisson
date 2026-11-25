/* COFFEE EMPIRE — upgrades, research, events, achievements, legacy, competitors. */
(function (global) {
'use strict';
const CE = global.CE = global.CE || {};

/* ---------- Upgrades ----------
   effect: { kind:'biz', biz, mult } | { kind:'mod', key, mult|add } | { kind:'combo', effects }
   Repeatable upgrades scale cost by costMult per level. */
CE.UPGRADES = [];
const U = CE.UPGRADES;

/* Per-business upgrade trees: 5 tiers each (240 upgrades), generated data-driven. */
const TIER_NAMES = {
  retail: ['Better Store Layout', 'Faster Service', 'Customer Experience Program', 'Loyalty Program', 'Premium Branding'],
  farm: ['Improved Irrigation', 'Fertilization Program', 'Automated Harvesting', 'Better Coffee Varieties', 'Precision Agriculture'],
  factory: ['Industrial Equipment', 'Automated Lines', 'Packaging Automation', 'Quality Control', 'Factory Optimization'],
  logistics: ['Larger Vehicles', 'Fuel Efficiency', 'Warehouse Automation', 'Route Optimization', 'Network Integration'],
  distribution: ['Sales Platform Upgrade', 'Fulfillment Automation', 'Customer Analytics', 'Channel Expansion', 'Market Dominance'],
  corporate: ['Better Management', 'Process Automation', 'Advanced Analytics', 'Global Talent', 'Industry Leadership']
};
const TIER_REQ = [5, 15, 30, 60, 120];
const TIER_COST = [12, 150, 2200, 35000, 600000];
const TIER_MULT = [2, 2, 2, 2, 3];
for (const b of CE.BUSINESSES) {
  for (let t = 0; t < 5; t++) {
    U.push({
      id: b.id + '_t' + t, name: TIER_NAMES[b.cat][t] + ' — ' + b.name,
      desc: b.name + ' output and revenue x' + TIER_MULT[t] + '.',
      cost: b.cost * TIER_COST[t], cat: b.cat,
      req: { biz: [b.id, TIER_REQ[t]] },
      effect: { kind: 'biz', biz: b.id, mult: TIER_MULT[t] }
    });
  }
}
/* Hand-crafted global upgrades. */
const G = [
  ['machines1', 'Better Espresso Machines', 'Professional two-group machines. Manual brewing x2, all retail x1.25.', 500, { kind: 'combo', effects: [{ kind: 'mod', key: 'manualMult', mult: 2 }, { kind: 'mod', key: 'retailMult', mult: 1.25 }] }, { rev: 200 }],
  ['grinders1', 'Professional Grinders', 'Consistent particle size. All retail revenue x1.25.', 2500, { kind: 'mod', key: 'retailRevMult', mult: 1.25 }, { rev: 1000 }],
  ['autoBrew1', 'Automatic Brewing', 'Volumetric dosing. Manual brewing x3.', 8000, { kind: 'mod', key: 'manualMult', mult: 3 }, { rev: 3000 }],
  ['highPressure', 'High-Pressure Extraction', '18-bar pumps. All retail revenue x1.5.', 60000, { kind: 'mod', key: 'retailRevMult', mult: 1.5 }, { rev: 25000 }],
  ['industrialMachines', 'Industrial Coffee Machines', 'Super-automatics in every store. All retail x2.', 2e6, { kind: 'mod', key: 'retailMult', mult: 2 }, { rev: 8e5 }],
  ['smartBrew', 'Smart Brewing Systems', 'IoT-connected brewers. All retail x2, bean usage -10%.', 5e8, { kind: 'combo', effects: [{ kind: 'mod', key: 'retailMult', mult: 2 }, { kind: 'mod', key: 'beanUseMult', mult: 0.9 }] }, { rev: 2e8 }],
  ['localAds', 'Local Advertising', 'Flyers and radio spots. Demand x1.15.', 5000, { kind: 'mod', key: 'demandMult', mult: 1.15 }, { rev: 2000 }],
  ['billboards', 'Billboards', 'Highway visibility. Demand x1.2.', 80000, { kind: 'mod', key: 'demandMult', mult: 1.2 }, { rev: 30000 }],
  ['socialMedia', 'Social Media Presence', 'Latte art goes viral. Demand x1.25, brand growth x1.5.', 1.5e6, { kind: 'combo', effects: [{ kind: 'mod', key: 'demandMult', mult: 1.25 }, { kind: 'mod', key: 'brandGrowth', mult: 1.5 }] }, { rev: 6e5 }],
  ['influencers', 'Influencer Partnerships', 'Coffee TikTok. Demand x1.35.', 4e7, { kind: 'mod', key: 'demandMult', mult: 1.35 }, { rev: 1.5e7 }],
  ['intlCampaigns', 'International Campaigns', 'Airport ads worldwide. Demand x1.5.', 2e9, { kind: 'mod', key: 'demandMult', mult: 1.5 }, { rev: 8e8 }],
  ['sponsorships', 'Brand Sponsorships', 'Formula 1 espresso partner. Demand x1.75, brand growth x2.', 1e11, { kind: 'combo', effects: [{ kind: 'mod', key: 'demandMult', mult: 1.75 }, { kind: 'mod', key: 'brandGrowth', mult: 2 }] }, { rev: 4e10 }],
  ['fuelEff', 'Fuel Efficiency Program', 'Aerodynamic fleets. Logistics costs -25%.', 300000, { kind: 'mod', key: 'logisticsOpexMult', mult: 0.75 }, { rev: 120000 }],
  ['routeOpt', 'Route Optimization', 'AI dispatching. Transport capacity x1.5.', 5e6, { kind: 'mod', key: 'transportMult', mult: 1.5 }, { rev: 2e6 }],
  ['coldChain', 'Cold Chain Logistics', 'Refrigerated transport. Distribution revenue x1.5.', 8e7, { kind: 'mod', key: 'distRevMult', mult: 1.5 }, { rev: 3e7 }],
  ['mgmt1', 'Better Management', 'Lean operations. All operating costs -10%.', 25000, { kind: 'mod', key: 'opexMult', mult: 0.9 }, { rev: 10000 }],
  ['mgmt2', 'Administrative Automation', 'ERP rollout. All operating costs -15%.', 3e6, { kind: 'mod', key: 'opexMult', mult: 0.85 }, { rev: 1.2e6 }],
  ['mgmt3', 'Advanced Financial Systems', 'Real-time treasury. All operating costs -20%.', 4e8, { kind: 'mod', key: 'opexMult', mult: 0.8 }, { rev: 1.5e8 }],
  ['mgmt4', 'International Management', 'Regional HQs. All operating costs -20%, international revenue x1.25.', 6e10, { kind: 'combo', effects: [{ kind: 'mod', key: 'opexMult', mult: 0.8 }, { kind: 'mod', key: 'intlMult', mult: 1.25 }] }, { rev: 2e10 }],
  ['wages1', 'Staff Training Program', 'Productivity workshops. Wages -15%.', 15000, { kind: 'mod', key: 'wageMult', mult: 0.85 }, { rev: 6000 }],
  ['wages2', 'Company-wide Staffing Standards', 'Cross-training. Wages -20%.', 2e7, { kind: 'mod', key: 'wageMult', mult: 0.8 }, { rev: 8e6 }],
  ['quality1', 'Cupping Lab', 'Every lot scored. Product quality +0.2.', 40000, { kind: 'mod', key: 'qualityBonus', add: 0.2 }, { rev: 15000 }],
  ['quality2', 'Q-Graders on Staff', 'Certified tasters. Product quality +0.3.', 9e6, { kind: 'mod', key: 'qualityBonus', add: 0.3 }, { rev: 3.5e6 }],
  ['waste1', 'Waste Reduction', 'Chaff recycling and reuse. Factory inputs -10%.', 500000, { kind: 'mod', key: 'inputUseMult', mult: 0.9 }, { rev: 200000 }],
  ['waste2', 'Zero-Waste Manufacturing', 'Closed-loop factories. Factory inputs -15%.', 7e7, { kind: 'mod', key: 'inputUseMult', mult: 0.85 }, { rev: 2.5e7 }],
  ['storage1', 'Inventory Software', 'Barcode tracking. Storage capacity x1.5.', 120000, { kind: 'mod', key: 'storageMult', mult: 1.5 }, { rev: 50000 }],
  ['storage2', 'Automated Storage', 'Robotic pickers. Storage capacity x2.', 2.5e7, { kind: 'mod', key: 'storageMult', mult: 2 }, { rev: 1e7 }],
  ['rp1', 'R&D Grant Program', 'Government grants. Research point gain x1.5.', 200000, { kind: 'mod', key: 'rpMult', mult: 1.5 }, { rev: 80000 }],
  ['rp2', 'Open Innovation Lab', 'University partnerships. Research point gain x2.', 5e7, { kind: 'mod', key: 'rpMult', mult: 2 }, { rev: 2e7 }],
  ['valuation1', 'Investor Relations', 'Quarterly roadshows. Company valuation x1.25.', 1e8, { kind: 'mod', key: 'valuationMult', mult: 1.25 }, { rev: 4e7 }],
  ['acquisitionEff', 'Acquisition Efficiency', 'M&A playbook. Acquisition prices -20%.', 8e9, { kind: 'mod', key: 'acquireCostMult', mult: 0.8 }, { research: 'acquisitions' }]
];
for (const [id, name, desc, cost, effect, req] of G) U.push({ id, name, desc, cost, cat: 'global', effect, req });

/* Manual-brewing equipment (unlocked through early milestones). */
const EQUIP = [
  ['autoGrinder', 'Automatic Grinder', 'Removes the manual grinding step entirely.', 1500, { kind: 'unlock', key: 'grinder' }, { milestone: 'sell10' }],
  ['proMachine', 'Professional Espresso Machine', 'Prep & brew steps 50% faster. +1 cup per manual brew (x2).', 5000, { kind: 'combo', effects: [{ kind: 'unlock', key: 'proMachine' }, { kind: 'mod', key: 'manualMult', mult: 2 }] }, { milestone: 'sell25' }],
  ['milkSteamer', 'Automatic Milk Steamer', 'Steaming milk becomes instant.', 12000, { kind: 'unlock', key: 'milkSteamer' }, { milestone: 'rev1000' }],
  ['coldBrewKit', 'Cold Brew Kit', 'Cold steeping takes half the time.', 8000, { kind: 'unlock', key: 'coldBrewKit' }, { milestone: 'sell100' }]
];
for (const [id, name, desc, cost, effect, req] of EQUIP) U.push({ id, name, desc, cost, cat: 'global', effect, req });

/* Repeatable upgrades (infinite levels, escalating cost). */
CE.REPEATABLES = [
  { id: 'rep_brewspeed', name: 'Barista Training', desc: 'All manual brewing steps 15% faster per level.', cost: 500, costMult: 8, cat: 'global', effect: { kind: 'mod', key: 'brewSpeed', mult: 1.15 } },
  { id: 'rep_brew', name: 'Espresso Machine Calibration', desc: 'Manual brewing x1.5 per level.', cost: 250, costMult: 10, cat: 'global', effect: { kind: 'mod', key: 'manualMult', mult: 1.5 } },
  { id: 'rep_demand', name: 'Neighborhood Outreach', desc: 'Demand x1.1 per level.', cost: 10000, costMult: 12, cat: 'global', effect: { kind: 'mod', key: 'demandMult', mult: 1.1 } },
  { id: 'rep_farm', name: 'Soil Improvement', desc: 'Farm output x1.15 per level.', cost: 25000, costMult: 12, cat: 'global', effect: { kind: 'mod', key: 'farmMult', mult: 1.15 } },
  { id: 'rep_factory', name: 'Line Balancing', desc: 'Factory output x1.15 per level.', cost: 100000, costMult: 12, cat: 'global', effect: { kind: 'mod', key: 'factoryMult', mult: 1.15 } },
  { id: 'rep_opex', name: 'Energy Audits', desc: 'Operating costs x0.97 per level.', cost: 50000, costMult: 14, cat: 'global', effect: { kind: 'mod', key: 'opexMult', mult: 0.97 } },
  { id: 'rep_storage', name: 'Extra Shelving', desc: 'Storage capacity x1.25 per level.', cost: 20000, costMult: 10, cat: 'global', effect: { kind: 'mod', key: 'storageMult', mult: 1.25 } }
];
CE.UPGRADE_MAP = {}; U.forEach(u => CE.UPGRADE_MAP[u.id] = u);
CE.REPEATABLE_MAP = {}; CE.REPEATABLES.forEach(u => CE.REPEATABLE_MAP[u.id] = u);
})(typeof window !== 'undefined' ? window : globalThis);
