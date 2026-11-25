/* COFFEE EMPIRE — research tree, events, campaigns, competitors, acquisitions. */
(function (global) {
'use strict';
const CE = global.CE = global.CE || {};

/* ---------- Research tree ----------
   cost: Research Points, time: seconds. Effects use the same modifier system
   as upgrades; 'unlock' effects enable real features. */
CE.RESEARCH = [
  /* Agriculture */
  { id: 'advIrrigation', cat: 'Agriculture', name: 'Advanced Irrigation', desc: 'Drip irrigation everywhere. Farm output x1.5.', cost: 20, time: 60, req: [], effects: [{ kind: 'mod', key: 'farmMult', mult: 1.5 }] },
  { id: 'highYield', cat: 'Agriculture', name: 'High-Yield Plants', desc: 'Hybrid varieties. Farm output x2.', cost: 60, time: 180, req: ['advIrrigation'], effects: [{ kind: 'mod', key: 'farmMult', mult: 2 }] },
  { id: 'autoHarvest', cat: 'Agriculture', name: 'Automated Harvesting', desc: 'Mechanical pickers. Farms run even unstaffed (50%+). Output x2, farms need 50% fewer workers.', cost: 200, time: 600, req: ['highYield'], effects: [{ kind: 'mod', key: 'farmMult', mult: 2 }, { kind: 'mod', key: 'farmStaffMult', mult: 0.5 }, { kind: 'unlock', key: 'autoFarms' }] },
  { id: 'precisionFarming', cat: 'Agriculture', name: 'Precision Farming', desc: 'Drone scouting and soil sensors. Farm output x3, specialty output x2.', cost: 800, time: 1800, req: ['autoHarvest'], effects: [{ kind: 'mod', key: 'farmMult', mult: 3 }, { kind: 'mod', key: 'specialtyMult', mult: 2 }] },
  /* Coffee Science */
  { id: 'advRoasting', cat: 'Coffee Science', name: 'Advanced Roasting', desc: 'Profile-controlled roasts. Roasting output x1.5.', cost: 25, time: 90, req: [], effects: [{ kind: 'biz', biz: 'roastery', mult: 1.5 }, { kind: 'biz', biz: 'industrialRoast', mult: 1.5 }] },
  { id: 'specialtyBlending', cat: 'Coffee Science', name: 'Specialty Blending', desc: 'Unlocks Specialty Coffee drinks, Premium Blend packaging and the Greenhouse Research Farm.', cost: 80, time: 240, req: ['advRoasting'], effects: [{ kind: 'unlock', key: 'specialty' }] },
  { id: 'extractionOpt', cat: 'Coffee Science', name: 'Extraction Optimization', desc: 'Perfect brew ratios. Drinks use 25% fewer beans.', cost: 150, time: 480, req: ['specialtyBlending'], effects: [{ kind: 'mod', key: 'beanUseMult', mult: 0.75 }] },
  { id: 'premiumDev', cat: 'Coffee Science', name: 'Premium Coffee Development', desc: 'Competition-grade lots. Quality +0.5, customers tolerate higher prices.', cost: 500, time: 1200, req: ['extractionOpt'], effects: [{ kind: 'mod', key: 'qualityBonus', add: 0.5 }, { kind: 'mod', key: 'elasticityBonus', mult: 0.8 }] },
  /* Manufacturing */
  { id: 'autoProduction', cat: 'Manufacturing', name: 'Automated Production', desc: 'PLC-controlled lines: factories run even unstaffed (50%+). All factories x1.5.', cost: 40, time: 120, req: [], effects: [{ kind: 'mod', key: 'factoryMult', mult: 1.5 }, { kind: 'unlock', key: 'autoFactory' }] },
  { id: 'industrialPackaging', cat: 'Manufacturing', name: 'Industrial Packaging', desc: 'High-speed packers. Packaging Factory x2.', cost: 120, time: 360, req: ['autoProduction'], effects: [{ kind: 'biz', biz: 'packagingFactory', mult: 2 }] },
  { id: 'smartQC', cat: 'Manufacturing', name: 'Smart Quality Control', desc: 'Vision systems reject defects early. Factory inputs -15%.', cost: 300, time: 900, req: ['industrialPackaging'], effects: [{ kind: 'mod', key: 'inputUseMult', mult: 0.85 }] },
  { id: 'highSpeedMfg', cat: 'Manufacturing', name: 'High-Speed Manufacturing', desc: 'Lights-out factories. All factories x3.', cost: 1200, time: 2400, req: ['smartQC'], effects: [{ kind: 'mod', key: 'factoryMult', mult: 3 }] },
  /* Retail */
  { id: 'serviceTraining', cat: 'Retail', name: 'Service Training', desc: 'Barista championships. All retail throughput x1.5.', cost: 30, time: 90, req: [], effects: [{ kind: 'mod', key: 'retailMult', mult: 1.5 }] },
  { id: 'loyaltyProgram', cat: 'Retail', name: 'Loyalty Program', desc: 'Points and free birthday lattes. Demand x1.25.', cost: 100, time: 300, req: ['serviceTraining'], effects: [{ kind: 'mod', key: 'demandMult', mult: 1.25 }] },
  { id: 'premiumBranding', cat: 'Retail', name: 'Premium Branding', desc: 'Designer cups, signature drinks. Retail revenue x1.5.', cost: 350, time: 900, req: ['loyaltyProgram'], effects: [{ kind: 'mod', key: 'retailRevMult', mult: 1.5 }] },
  { id: 'flagshipExperience', cat: 'Retail', name: 'Flagship Experience', desc: 'Roastery-tourism hybrids. All retail throughput x2.5.', cost: 1500, time: 2700, req: ['premiumBranding'], effects: [{ kind: 'mod', key: 'retailMult', mult: 2.5 }] },
  /* Logistics */
  { id: 'routeOptR', cat: 'Logistics', name: 'Route Optimization', desc: 'Dynamic routing. Transport x2, logistics costs -25%.', cost: 50, time: 150, req: [], effects: [{ kind: 'mod', key: 'transportMult', mult: 2 }, { kind: 'mod', key: 'logisticsOpexMult', mult: 0.75 }] },
  { id: 'warehouseAutomation', cat: 'Logistics', name: 'Warehouse Automation', desc: 'AS/RS systems. Storage capacity x3.', cost: 150, time: 450, req: ['routeOptR'], effects: [{ kind: 'mod', key: 'storageMult', mult: 3 }] },
  { id: 'coldChainR', cat: 'Logistics', name: 'Cold Chain Network', desc: 'Fresh dairy everywhere. Distribution revenue x2.', cost: 400, time: 1000, req: ['warehouseAutomation'], effects: [{ kind: 'mod', key: 'distRevMult', mult: 2 }] },
  { id: 'globalDistribution', cat: 'Logistics', name: 'Global Distribution', desc: 'Intercontinental freight lanes. Distribution revenue x3, transport x2.', cost: 1200, time: 2400, req: ['coldChainR'], effects: [{ kind: 'mod', key: 'distRevMult', mult: 3 }, { kind: 'mod', key: 'transportMult', mult: 2 }] },
  /* Marketing */
  { id: 'localAdsR', cat: 'Marketing', name: 'Local Advertising', desc: 'Community sponsorships. Demand x1.15.', cost: 20, time: 60, req: [], effects: [{ kind: 'mod', key: 'demandMult', mult: 1.15 }] },
  { id: 'socialMediaR', cat: 'Marketing', name: 'Social Media Strategy', desc: 'Always-on content. Brand growth x2.', cost: 80, time: 240, req: ['localAdsR'], effects: [{ kind: 'mod', key: 'brandGrowth', mult: 2 }] },
  { id: 'influencerR', cat: 'Marketing', name: 'Influencer Network', desc: 'Barista celebrities. Demand x1.3.', cost: 250, time: 700, req: ['socialMediaR'], effects: [{ kind: 'mod', key: 'demandMult', mult: 1.3 }] },
  { id: 'globalCampaigns', cat: 'Marketing', name: 'Global Campaigns', desc: 'One brand, every language. Demand x1.5.', cost: 900, time: 2000, req: ['influencerR'], effects: [{ kind: 'mod', key: 'demandMult', mult: 1.5 }] },
  /* Automation */
  { id: 'autoInventory', cat: 'Automation', name: 'Automatic Inventory', desc: 'Unlocks automatic purchasing: set min/max thresholds per resource and suppliers restock for you.', cost: 30, time: 45, req: [], effects: [{ kind: 'unlock', key: 'autoBuy' }] },
  { id: 'intelligentPurchasing', cat: 'Automation', name: 'Intelligent Purchasing', desc: 'Buy-the-dip algorithms. Auto-purchase prices -15%.', cost: 100, time: 300, req: ['autoInventory'], effects: [{ kind: 'mod', key: 'buyPriceMult', mult: 0.85 }, { kind: 'unlock', key: 'smartBuy' }] },
  { id: 'productionScheduling', cat: 'Automation', name: 'Production Scheduling', desc: 'Unlocks recipe priority controls. All factories x1.25.', cost: 200, time: 600, req: ['intelligentPurchasing'], effects: [{ kind: 'unlock', key: 'scheduling' }, { kind: 'mod', key: 'factoryMult', mult: 1.25 }] },
  { id: 'autoDistribution', cat: 'Automation', name: 'Automated Distribution', desc: 'Unlocks auto-distribution: packaged goods flow to sales channels without logistics penalties. Transport x2.', cost: 500, time: 1200, req: ['productionScheduling'], effects: [{ kind: 'unlock', key: 'autoDist' }, { kind: 'unlock', key: 'autoLogistics' }, { kind: 'mod', key: 'transportMult', mult: 2 }] },
  { id: 'timelessOps', cat: 'Automation', name: 'Timeless Operations', desc: 'Night shifts and remote management. Offline cap +12 hours.', cost: 400, time: 900, req: ['productionScheduling'], effects: [{ kind: 'mod', key: 'offlineCapH', add: 12 }] },
  { id: 'integratedMgmt', cat: 'Automation', name: 'Integrated Business Management', desc: 'One system runs everything: ALL businesses operate unstaffed at 75%+. Operating costs -20%.', cost: 2000, time: 3600, req: ['autoDistribution'], effects: [{ kind: 'mod', key: 'staffFloor', set: 0.75 }, { kind: 'mod', key: 'opexMult', mult: 0.8 }, { kind: 'unlock', key: 'autoCorporate' }, { kind: 'unlock', key: 'autoRetail' }] },
  /* Corporate Management */
  { id: 'betterMgmt', cat: 'Corporate Management', name: 'Better Management', desc: 'Professional leadership. Operating costs -15%.', cost: 60, time: 180, req: [], effects: [{ kind: 'mod', key: 'opexMult', mult: 0.85 }] },
  { id: 'acquisitions', cat: 'Corporate Management', name: 'Acquisitions', desc: 'Unlocks corporate acquisitions: buy competitors and companies outright.', cost: 250, time: 700, req: ['betterMgmt'], effects: [{ kind: 'unlock', key: 'acquisitions' }] },
  { id: 'advFinance', cat: 'Corporate Management', name: 'Advanced Financial Systems', desc: 'Treasury optimization. Interest x2, valuation x1.5.', cost: 700, time: 1500, req: ['acquisitions'], effects: [{ kind: 'mod', key: 'interestMult', mult: 2 }, { kind: 'mod', key: 'valuationMult', mult: 1.5 }] },
  { id: 'intlMgmt', cat: 'Corporate Management', name: 'International Management', desc: 'Regional divisions. Expansion costs -50%, international revenue x1.5.', cost: 1500, time: 3000, req: ['advFinance'], effects: [{ kind: 'mod', key: 'expandCostMult', mult: 0.5 }, { kind: 'mod', key: 'intlMult', mult: 1.5 }, { kind: 'unlock', key: 'regionalMgmt' }] }
];
CE.RESEARCH_MAP = {}; CE.RESEARCH.forEach(r => CE.RESEARCH_MAP[r.id] = r);
CE.RESEARCH_CATS = ['Agriculture', 'Coffee Science', 'Manufacturing', 'Retail', 'Logistics', 'Marketing', 'Automation', 'Corporate Management'];
/* ---------- Economic events ----------
   effects use modifier keys; market* keys multiply commodity prices.
   dur in seconds, weight = relative probability. */
CE.EVENTS = [
  { id: 'recordHarvest', name: 'Record Coffee Harvest', good: true, weight: 10, dur: [120, 300], desc: 'Perfect weather worldwide. Farms produce double.', effects: [{ key: 'farmMult', mult: 2 }, { key: 'marketBeans', mult: 0.7 }] },
  { id: 'viralTrend', name: 'Viral Coffee Trend', good: true, weight: 9, dur: [90, 240], desc: 'Your drinks are all over social media. Demand surges.', effects: [{ key: 'demandMult', mult: 1.75 }] },
  { id: 'supplierDiscount', name: 'Supplier Discount', good: true, weight: 10, dur: [120, 300], desc: 'Suppliers clear inventory. Purchasing costs -40%.', effects: [{ key: 'buyPriceMult', mult: 0.6 }] },
  { id: 'competitorBankruptcy', name: 'Competitor Bankruptcy', good: true, weight: 4, dur: [180, 360], desc: 'A rival collapses. Their customers flock to you.', effects: [{ key: 'demandMult', mult: 1.25 }], special: 'bankruptcy' },
  { id: 'seasonalDemand', name: 'Seasonal Demand Spike', good: true, weight: 9, dur: [120, 240], desc: 'Holiday season! Everyone wants coffee.', effects: [{ key: 'demandMult', mult: 1.4 }] },
  { id: 'marketingSuccess', name: 'Marketing Campaign Success', good: true, weight: 7, dur: [120, 240], desc: 'A campaign overperforms. Brand reputation jumps.', effects: [{ key: 'demandMult', mult: 1.3 }], special: 'brandBoost' },
  { id: 'coffeeShortage', name: 'Global Coffee Shortage', good: false, weight: 7, dur: [120, 300], desc: 'Bean prices spike and suppliers ration shipments.', effects: [{ key: 'marketBeans', mult: 2.2 }, { key: 'supplierAvail', mult: 0.5 }] },
  { id: 'poorHarvest', name: 'Poor Harvest', good: false, weight: 8, dur: [120, 300], desc: 'Drought hits the coffee belt. Farm output halved.', effects: [{ key: 'farmMult', mult: 0.5 }, { key: 'marketBeans', mult: 1.5 }] },
  { id: 'breakdown', name: 'Equipment Breakdown', good: false, weight: 7, dur: [60, 180], desc: 'A critical roaster fails. Factory output -40%.', effects: [{ key: 'factoryMult', mult: 0.6 }] },
  { id: 'shippingDisruption', name: 'Shipping Disruption', good: false, weight: 6, dur: [90, 240], desc: 'Port congestion. Transport capacity -60%.', effects: [{ key: 'transportMult', mult: 0.4 }] },
  { id: 'fuelSpike', name: 'Fuel Price Increase', good: false, weight: 8, dur: [120, 300], desc: 'Oil markets tighten. Logistics costs double.', effects: [{ key: 'marketFuel', mult: 2 }] },
  { id: 'downturn', name: 'Economic Downturn', good: false, weight: 6, dur: [150, 300], desc: 'Consumers tighten belts. Demand -35%.', effects: [{ key: 'demandMult', mult: 0.65 }] },
  { id: 'priceWar', name: 'Competitor Price War', good: false, weight: 6, dur: [90, 240], desc: 'Rivals slash prices. Demand -20% while it lasts.', effects: [{ key: 'demandMult', mult: 0.8 }], special: 'priceWar' }
];
CE.EVENT_MAP = {}; CE.EVENTS.forEach(e => CE.EVENT_MAP[e.id] = e);
/* ---------- Marketing campaigns (player-activated) ----------
   cost scales with lifetime revenue so campaigns stay relevant. */
CE.CAMPAIGNS = [
  { id: 'flyers', name: 'Local Flyer Drop', baseCost: 2000, scale: 0.002, dur: 120, demand: 1.5, brand: 2, desc: 'x1.5 demand for 2 minutes.' },
  { id: 'radio', name: 'Radio & Podcast Ads', baseCost: 50000, scale: 0.004, dur: 300, demand: 1.75, brand: 5, desc: 'x1.75 demand for 5 minutes.' },
  { id: 'tv', name: 'Prime-time TV Spot', baseCost: 2e6, scale: 0.008, dur: 600, demand: 2.25, brand: 12, desc: 'x2.25 demand for 10 minutes.' }
];

/* ---------- AI competitors ---------- */
CE.COMPETITORS = [
  { id: 'beanThere', name: 'Bean There Inc.', val: 5e4, rev: 15, growth: 0.0009, quality: 0.9, style: 'Discount giant', sprite: 'vending' },
  { id: 'javaGiant', name: 'Java Giant', val: 4e5, rev: 60, growth: 0.0011, quality: 1.0, style: 'Aggressive expander', sprite: 'chain' },
  { id: 'morningMug', name: 'Morning Mug Co.', val: 2e6, rev: 220, growth: 0.0008, quality: 1.1, style: 'Premium play', sprite: 'premium' },
  { id: 'roastCo', name: 'Roast & Co.', val: 1.5e7, rev: 900, growth: 0.0007, quality: 1.2, style: 'Vertically integrated', sprite: 'roastery' },
  { id: 'continental', name: 'Café Continental', val: 8e7, rev: 3500, growth: 0.0006, quality: 1.3, style: 'Global incumbent', sprite: 'corporation' }
];

/* ---------- Acquisition targets (one-time purchases) ---------- */
CE.ACQUISITIONS = [
  { id: 'acqCorner', name: 'Corner Coffee Chain', cost: 2e6, desc: 'A beloved 12-store local chain.', grants: { standardShop: 6, smallShop: 8 }, bonus: { key: 'demandMult', mult: 1.05 } },
  { id: 'acqPlantation', name: 'Highland Plantations', cost: 2e7, desc: 'Established estates with mature trees.', grants: { largePlantation: 4, mediumPlantation: 6 }, bonus: { key: 'farmMult', mult: 1.1 } },
  { id: 'acqRoaster', name: 'Ember Roasting Works', cost: 1.5e8, desc: 'A contract roaster with industrial lines.', grants: { industrialRoast: 3, roastery: 5 }, bonus: { key: 'factoryMult', mult: 1.1 } },
  { id: 'acqDistribution', name: 'Meridian Distribution', cost: 1e9, desc: 'A regional distribution network.', grants: { trucking: 4, regionalWarehouse: 4, wholesale: 1 }, bonus: { key: 'transportMult', mult: 1.15 } },
  { id: 'acqCapsules', name: 'PodPerfect Ltd.', cost: 8e9, desc: 'Capsule patents and factories.', grants: { capsuleFactory: 4, packagingFactory: 3 }, bonus: { key: 'factoryMult', mult: 1.15 } },
  { id: 'acqRetail', name: 'UrbanBrew Locations', cost: 6e10, desc: 'Prime real estate in 40 cities.', grants: { mallShop: 5, driveThrough: 8 }, bonus: { key: 'retailRevMult', mult: 1.1 } },
  { id: 'acqLogistics', name: 'TransOcean Freight', cost: 5e11, desc: 'Ships, planes and ports.', grants: { cargoShip: 4, freightAir: 2 }, bonus: { key: 'transportMult', mult: 1.25 } },
  { id: 'acqMedia', name: 'Caffeine Media Group', cost: 4e12, desc: 'A marketing powerhouse.', grants: { marketingAgency: 6 }, bonus: { key: 'demandMult', mult: 1.2 } }
];
})(typeof window !== 'undefined' ? window : globalThis);
