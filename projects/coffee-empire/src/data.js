/* COFFEE EMPIRE — static game data: resources, drinks, businesses, staff, regions. */
(function (global) {
'use strict';
const CE = global.CE = global.CE || {};

/* ---------- Resources ----------
   unit: kg | L | u (units). price: base market price per unit ($).
   cap: base storage capacity. commodity: market bucket that drives its price. */
CE.RESOURCES = {
  cherryA:   { name: 'Arabica Coffee Cherries', unit: 'kg', price: 0.6,  cap: 500,  cat: 'raw', commodity: 'beans' },
  cherryR:   { name: 'Robusta Coffee Cherries', unit: 'kg', price: 0.4,  cap: 500,  cat: 'raw', commodity: 'beans' },
  greenA:    { name: 'Green Arabica Beans',     unit: 'kg', price: 3,    cap: 300,  cat: 'raw', commodity: 'beans' },
  greenR:    { name: 'Green Robusta Beans',     unit: 'kg', price: 2,    cap: 300,  cat: 'raw', commodity: 'beans' },
  specialty: { name: 'Specialty Beans',         unit: 'kg', price: 14,   cap: 100,  cat: 'raw', commodity: 'beans', quality: true },
  roasted:   { name: 'Roasted Beans',           unit: 'kg', price: 8,    cap: 300,  cat: 'intermediate', commodity: 'beans', quality: true },
  ground:    { name: 'Ground Coffee',           unit: 'kg', price: 10,   cap: 300,  cat: 'intermediate', commodity: 'beans' },
  milk:      { name: 'Milk',                    unit: 'L',  price: 1.2,  cap: 200,  cat: 'raw', commodity: 'milk' },
  sugar:     { name: 'Sugar',                   unit: 'kg', price: 0.8,  cap: 200,  cat: 'raw', commodity: 'sugar' },
  cocoa:     { name: 'Cocoa',                   unit: 'kg', price: 6,    cap: 100,  cat: 'raw', commodity: 'cocoa' },
  water:     { name: 'Water',                   unit: 'L',  price: 0.05, cap: 1000, cat: 'raw', commodity: null },
  packaging: { name: 'Packaging Materials',     unit: 'u',  price: 0.15, cap: 2000, cat: 'intermediate', commodity: 'packaging' },
  capsules:  { name: 'Empty Capsules',          unit: 'u',  price: 0.05, cap: 5000, cat: 'intermediate', commodity: 'packaging' },
  bottles:   { name: 'Bottles',                 unit: 'u',  price: 0.12, cap: 3000, cat: 'intermediate', commodity: 'packaging' },
  boxes:     { name: 'Cardboard Boxes',         unit: 'u',  price: 0.3,  cap: 2000, cat: 'intermediate', commodity: 'packaging' },
  wholeBean:    { name: 'Whole Bean Coffee',      unit: 'u', price: 9,   cap: 1000, cat: 'product' },
  groundPack:   { name: 'Ground Coffee Pack',     unit: 'u', price: 8,   cap: 1000, cat: 'product' },
  instantPack:  { name: 'Instant Coffee Jar',     unit: 'u', price: 7,   cap: 1000, cat: 'product' },
  capsulePack:  { name: 'Capsule Box (10 ct)',    unit: 'u', price: 12,  cap: 1000, cat: 'product' },
  bottled:      { name: 'Bottled Iced Coffee',    unit: 'u', price: 4.5, cap: 2000, cat: 'product' },
  rtd:          { name: 'Ready-to-Drink Coffee',  unit: 'u', price: 3.5, cap: 2000, cat: 'product' },
  premiumBlend: { name: 'Premium Coffee Blend',   unit: 'u', price: 25,  cap: 500,  cat: 'product', quality: true },
  wholesaleBag: { name: 'Wholesale Coffee Bag',   unit: 'u', price: 90,  cap: 500,  cat: 'product' },
  machines:     { name: 'Coffee Machines',        unit: 'u', price: 120, cap: 200,  cat: 'product' }
};

/* Market commodities (fuel & electricity are cost inputs, not stored). */
CE.COMMODITIES = {
  beans:     { name: 'Coffee Beans', base: 1 },
  milk:      { name: 'Milk',         base: 1 },
  sugar:     { name: 'Sugar',        base: 1 },
  cocoa:     { name: 'Cocoa',        base: 1 },
  packaging: { name: 'Packaging',    base: 1 },
  fuel:      { name: 'Fuel',         base: 1 },
  electricity: { name: 'Electricity', base: 1 }
};

/* ---------- Drinks (retail products) ----------
   recipe: ingredients consumed per cup. elastic: price elasticity exponent. */
/* steps: the manual brewing pipeline. Ingredient consumption per step:
   grind → beans, brew/steep → water/sugar/cocoa, steam → milk. Serve → payment. */
CE.DRINKS = {
  regular:    { name: 'Regular Coffee',  price: 3,    elastic: 1.6, recipe: { roasted: 0.015, water: 0.2 }, steps: ['grind', 'brew', 'serve'] },
  espresso:   { name: 'Espresso',        price: 3.5,  elastic: 1.6, recipe: { roasted: 0.018, water: 0.03 }, steps: ['grind', 'prep', 'brew', 'serve'] },
  americano:  { name: 'Americano',       price: 3.75, elastic: 1.5, recipe: { roasted: 0.018, water: 0.25 }, steps: ['grind', 'prep', 'brew', 'serve'] },
  cappuccino: { name: 'Cappuccino',      price: 4.5,  elastic: 1.4, recipe: { roasted: 0.018, milk: 0.15, water: 0.05 }, steps: ['grind', 'prep', 'brew', 'steam', 'serve'] },
  latte:      { name: 'Latte',           price: 4.75, elastic: 1.4, recipe: { roasted: 0.018, milk: 0.25 }, steps: ['grind', 'prep', 'brew', 'steam', 'serve'] },
  mocha:      { name: 'Mocha',           price: 5.25, elastic: 1.3, recipe: { roasted: 0.02, milk: 0.2, cocoa: 0.02 }, steps: ['grind', 'prep', 'brew', 'steam', 'serve'] },
  flatwhite:  { name: 'Flat White',      price: 5,    elastic: 1.3, recipe: { roasted: 0.02, milk: 0.18 }, steps: ['grind', 'prep', 'brew', 'steam', 'serve'] },
  macchiato:  { name: 'Macchiato',       price: 4.25, elastic: 1.4, recipe: { roasted: 0.018, milk: 0.05 }, steps: ['grind', 'prep', 'brew', 'steam', 'serve'] },
  coldbrew:   { name: 'Cold Brew',       price: 5.5,  elastic: 1.2, recipe: { roasted: 0.025, water: 0.3 }, steps: ['grind', 'steep', 'serve'] },
  iced:       { name: 'Iced Coffee',     price: 4.5,  elastic: 1.4, recipe: { roasted: 0.018, water: 0.25, sugar: 0.01 }, steps: ['grind', 'brew', 'serve'] },
  specialty:  { name: 'Specialty Coffee', price: 8,   elastic: 1.0, recipe: { specialty: 0.02, water: 0.22 }, steps: ['grind', 'prep', 'brew', 'serve'], reqResearch: 'specialtyBlending' },
  seasonal:   { name: 'Seasonal Coffee', price: 6.5,  elastic: 1.2, recipe: { roasted: 0.02, milk: 0.1, sugar: 0.015, cocoa: 0.01 }, steps: ['grind', 'prep', 'brew', 'steam', 'serve'] }
};
CE.BREW_STEPS = {
  grind: { name: 'Grind Beans',       dur: 1.5, verb: 'Grinding beans…' },
  prep:  { name: 'Prepare Machine',   dur: 1.0, verb: 'Preparing the machine…' },
  brew:  { name: 'Brew',              dur: 2.0, verb: 'Brewing…' },
  steam: { name: 'Steam Milk',        dur: 1.5, verb: 'Steaming milk…' },
  steep: { name: 'Cold Steep',        dur: 6.0, verb: 'Steeping (cold brew takes time)…' },
  serve: { name: 'Serve Customer',    dur: 0.5, verb: 'Serving…' }
};

/* ---------- Businesses ----------
   cat: retail | farm | factory | logistics | distribution | corporate
   cost: base purchase cost ($), g: cost growth per owned unit,
   opex: operating expense per unit per second (rent, power, maintenance),
   staff: employees required per unit, unlock: requirement to appear,
   retail: cups = serving capacity/sec, menu = drink ids, quality,
   farm: out = resource kg/sec, factory: recipes (rate = cycles/sec/unit),
   logistics: storage = base-cap multiples added, transport = units/sec,
   distribution: sells = packaged products (rate units/sec/unit). */
CE.BUSINESSES = [
  /* --- Retail --- */
  { id: 'cart', name: 'Coffee Cart', cat: 'retail', sprite: 'cart', cost: 100, g: 1.15, opex: 0.02,
    staff: { barista: 1 }, cups: 0.4, quality: 1, menu: ['regular', 'espresso'],
    desc: 'A humble street cart. Every empire starts somewhere.' },
  { id: 'smallShop', name: 'Small Coffee Shop', cat: 'retail', sprite: 'shop', cost: 1200, g: 1.15, opex: 0.25,
    staff: { barista: 2, shopManager: 0.2 }, cups: 2, quality: 1.05, menu: ['regular', 'espresso', 'americano', 'cappuccino', 'latte'],
    unlock: { rev: 500 }, desc: 'Your first permanent location. A real milestone.' },
  { id: 'standardShop', name: 'Standard Coffee Shop', cat: 'retail', sprite: 'cafe', cost: 15000, g: 1.15, opex: 2,
    staff: { barista: 4, shopManager: 0.5 }, cups: 10, quality: 1.1, menu: ['regular', 'espresso', 'americano', 'cappuccino', 'latte', 'mocha', 'flatwhite', 'macchiato'],
    unlock: { rev: 6000 }, desc: 'A full-menu neighborhood café with loyal regulars.' },
  { id: 'premiumShop', name: 'Premium Coffee Shop', cat: 'retail', sprite: 'premium', cost: 200000, g: 1.15, opex: 18,
    staff: { barista: 8, shopManager: 1 }, cups: 40, quality: 1.3, menu: ['espresso', 'cappuccino', 'latte', 'flatwhite', 'coldbrew', 'specialty', 'seasonal'],
    unlock: { rev: 80000, rep: 20 }, desc: 'Single-origin pours and designer interiors.' },
  { id: 'driveThrough', name: 'Drive-through Coffee Shop', cat: 'retail', sprite: 'drive', cost: 2.5e6, g: 1.15, opex: 150,
    staff: { barista: 10, shopManager: 1 }, cups: 220, quality: 1.05, menu: ['regular', 'americano', 'latte', 'iced', 'macchiato', 'mocha'],
    unlock: { rev: 1e6 }, desc: 'Commuter fuel. Speed is the product.' },
  { id: 'bakeryCafe', name: 'Bakery Café', cat: 'retail', sprite: 'bakery', cost: 3e7, g: 1.15, opex: 1400,
    staff: { barista: 16, shopManager: 2 }, cups: 900, quality: 1.2, menu: ['regular', 'cappuccino', 'latte', 'mocha', 'seasonal', 'flatwhite'],
    unlock: { rev: 1.2e7 }, desc: 'Fresh pastries double the ticket size.' },
  { id: 'mallShop', name: 'Shopping Mall Coffee Shop', cat: 'retail', sprite: 'mall', cost: 4e8, g: 1.15, opex: 15000,
    staff: { barista: 24, shopManager: 2 }, cups: 4200, quality: 1.1, menu: ['regular', 'latte', 'mocha', 'iced', 'cappuccino', 'seasonal'],
    unlock: { rev: 1.5e8 }, desc: 'Endless foot traffic between the food court and the escalators.' },
  { id: 'airportShop', name: 'Airport Coffee Shop', cat: 'retail', sprite: 'airport', cost: 6e9, g: 1.15, opex: 180000,
    staff: { barista: 40, shopManager: 3 }, cups: 16000, quality: 1.1, priceMult: 1.3, menu: ['regular', 'americano', 'latte', 'cappuccino', 'coldbrew', 'espresso'],
    unlock: { rev: 2e9 }, desc: 'Captive travelers pay premium prices at gate B12.' },
  { id: 'flagship', name: 'Flagship Coffee Store', cat: 'retail', sprite: 'flagship', cost: 1e11, g: 1.15, opex: 2.5e6,
    staff: { barista: 80, shopManager: 5 }, cups: 60000, quality: 1.6, menu: ['specialty', 'coldbrew', 'flatwhite', 'latte', 'seasonal', 'mocha', 'cappuccino'],
    unlock: { rev: 4e10, rep: 45 }, desc: 'A three-story temple of coffee. Tourists photograph the espresso bar.' },
  { id: 'intlChain', name: 'International Coffee Chain', cat: 'retail', sprite: 'chain', cost: 2e12, g: 1.16, opex: 4e7,
    staff: { barista: 200, shopManager: 12 }, cups: 250000, quality: 1.3, menu: ['regular', 'latte', 'cappuccino', 'iced', 'seasonal', 'americano'],
    unlock: { rev: 8e11, regions: 2 }, desc: 'Hundreds of identical stores on every continent.' },
  { id: 'kioskNetwork', name: 'Coffee Kiosk Network', cat: 'retail', sprite: 'kiosk', cost: 3e13, g: 1.16, opex: 5e8,
    staff: { barista: 400, shopManager: 20 }, cups: 1.2e6, quality: 1.1, menu: ['regular', 'espresso', 'americano', 'latte', 'iced'],
    unlock: { rev: 1e13 }, desc: 'Ten thousand touch-screen kiosks in lobbies and stations.' },
  { id: 'luxuryLounge', name: 'Luxury Coffee Lounge', cat: 'retail', sprite: 'lounge', cost: 5e14, g: 1.17, opex: 7e9,
    staff: { barista: 600, shopManager: 40 }, cups: 4e6, quality: 2, priceMult: 1.5, menu: ['specialty', 'seasonal', 'flatwhite', 'mocha', 'coldbrew'],
    unlock: { rev: 2e14, rep: 70 }, desc: 'Membership-only lounges where a cup costs more than a flight.' },
  /* --- Agriculture --- */
  { id: 'smallFarm', name: 'Small Coffee Farm', cat: 'farm', sprite: 'farm', cost: 800, g: 1.16, opex: 0.05,
    staff: { farmWorker: 1 }, out: { cherryA: 0.5 }, unlock: { rev: 300 },
    desc: 'A hillside plot of arabica trees. Fresh cherries feed your chain.' },
  { id: 'mediumPlantation', name: 'Medium Coffee Plantation', cat: 'farm', sprite: 'plantation', cost: 25000, g: 1.16, opex: 1.5,
    staff: { farmWorker: 6, agManager: 0.3 }, out: { cherryA: 8, cherryR: 4 }, unlock: { rev: 10000 },
    desc: 'Rows of arabica and robusta across rolling hills.' },
  { id: 'largePlantation', name: 'Large Coffee Plantation', cat: 'farm', sprite: 'plantation2', cost: 1.5e6, g: 1.16, opex: 80,
    staff: { farmWorker: 30, agManager: 1 }, out: { cherryA: 120, cherryR: 80 }, unlock: { rev: 6e5 },
    desc: 'Industrial-scale harvesting with its own wet mill.' },
  { id: 'industrialEstate', name: 'Industrial Coffee Estate', cat: 'farm', sprite: 'estate', cost: 2e8, g: 1.17, opex: 8000,
    staff: { farmWorker: 120, agManager: 3 }, out: { cherryA: 2500, cherryR: 2000, specialty: 20 }, unlock: { rev: 8e7 },
    desc: 'A self-contained agropolis producing premium lots.' },
  { id: 'greenhouse', name: 'Greenhouse Research Farm', cat: 'farm', sprite: 'greenhouse', cost: 5e9, g: 1.17, opex: 150000,
    staff: { farmWorker: 40, researcher: 2 }, out: { specialty: 400 }, unlock: { rev: 2e9, research: 'specialtyBlending' },
    desc: 'Climate-controlled experimental varieties. Pure specialty output.' },
  { id: 'agSupply', name: 'Agricultural Supply Company', cat: 'farm', sprite: 'agsupply', cost: 1e11, g: 1.2, opex: 2e6,
    staff: { agManager: 5, logisticsWorker: 10 }, effect: 'agSupply', unlock: { rev: 4e10 },
    desc: 'Seeds, fertilizer and machinery for every farm you own. Boosts all farm output.' },
  /* --- Manufacturing (part 1) --- */
  { id: 'processing', name: 'Bean Processing Facility', cat: 'factory', sprite: 'processing', cost: 3000, g: 1.16, opex: 0.3,
    staff: { factoryWorker: 2 }, unlock: { rev: 1200 },
    recipes: [
      { id: 'wetMillA', name: 'Wash Arabica', in: { cherryA: 5 }, out: { greenA: 1 }, rate: 0.6, w: 1 },
      { id: 'wetMillR', name: 'Wash Robusta', in: { cherryR: 5 }, out: { greenR: 1 }, rate: 0.6, w: 1 }
    ], desc: 'Washes and dries cherries into green coffee beans (5:1).' },
  { id: 'roastery', name: 'Coffee Roastery', cat: 'factory', sprite: 'roastery', cost: 12000, g: 1.16, opex: 1,
    staff: { factoryWorker: 2, factoryManager: 0.2 }, unlock: { rev: 5000 },
    recipes: [
      { id: 'roastA', name: 'Roast Arabica', in: { greenA: 1.2 }, out: { roasted: 1 }, rate: 0.5, w: 1 },
      { id: 'roastR', name: 'Roast Robusta', in: { greenR: 1.2 }, out: { roasted: 1 }, rate: 0.5, w: 1 }
    ], desc: 'Drum roasters turn green beans into aromatic roasted coffee.' },
  { id: 'industrialRoast', name: 'Industrial Roasting Plant', cat: 'factory', sprite: 'roastplant', cost: 8e6, g: 1.16, opex: 400,
    staff: { factoryWorker: 20, factoryManager: 1 }, unlock: { rev: 3e6 },
    recipes: [
      { id: 'bigRoastA', name: 'Bulk Roast Arabica', in: { greenA: 1.2 }, out: { roasted: 1 }, rate: 80, w: 1 },
      { id: 'bigRoastR', name: 'Bulk Roast Robusta', in: { greenR: 1.2 }, out: { roasted: 1 }, rate: 80, w: 1 }
    ], desc: 'Continuous roasting lines running around the clock.' },
  { id: 'groundFactory', name: 'Ground Coffee Factory', cat: 'factory', sprite: 'grinder', cost: 60000, g: 1.16, opex: 5,
    staff: { factoryWorker: 3 }, unlock: { rev: 25000 },
    recipes: [ { id: 'grind', name: 'Grind Roasted Beans', in: { roasted: 1 }, out: { ground: 1 }, rate: 1.2, w: 1 } ],
    desc: 'Precision burr grinders produce retail-grade ground coffee.' },
  { id: 'instantFactory', name: 'Instant Coffee Factory', cat: 'factory', sprite: 'instant', cost: 2e6, g: 1.16, opex: 100,
    staff: { factoryWorker: 6, factoryManager: 0.5 }, unlock: { rev: 8e5 },
    recipes: [ { id: 'freezeDry', name: 'Freeze-Dry Instant', in: { roasted: 0.5, packaging: 2 }, out: { instantPack: 4 }, rate: 1, w: 1 } ],
    desc: 'Freeze-drying towers and jar filling lines.' },
  /* --- Manufacturing (part 2) --- */
  { id: 'capsuleFactory', name: 'Coffee Capsule Factory', cat: 'factory', sprite: 'capsule', cost: 1.2e7, g: 1.16, opex: 600,
    staff: { factoryWorker: 10, factoryManager: 1 }, unlock: { rev: 5e6 },
    recipes: [ { id: 'fillCaps', name: 'Fill Capsule Boxes', in: { ground: 0.06, capsules: 10 }, out: { capsulePack: 1 }, rate: 3, w: 1 } ],
    desc: 'Nitrogen-flushed capsules for every machine on the market.' },
  { id: 'bottledFactory', name: 'Bottled Coffee Factory', cat: 'factory', sprite: 'bottled', cost: 8e7, g: 1.16, opex: 3500,
    staff: { factoryWorker: 16, factoryManager: 1 }, unlock: { rev: 3e7 },
    recipes: [ { id: 'bottleCold', name: 'Bottle Iced Coffee', in: { ground: 0.02, milk: 0.1, sugar: 0.015, bottles: 1 }, out: { bottled: 1 }, rate: 12, w: 1 } ],
    desc: 'Cold-fill lines producing bottled iced coffee.' },
  { id: 'packagingFactory', name: 'Packaging Factory', cat: 'factory', sprite: 'packaging', cost: 400000, g: 1.16, opex: 20,
    staff: { factoryWorker: 6, factoryManager: 0.5 }, unlock: { rev: 150000 },
    recipes: [
      /* cashIn = raw materials (paper, plastic, glass) bought per cycle, charged as COGS. */
      { id: 'makePackaging', name: 'Produce Packaging', in: {}, cashIn: 2.4, out: { packaging: 20, boxes: 2 }, rate: 1, w: 2 },
      { id: 'makeBottles', name: 'Blow Bottles', in: {}, cashIn: 0.8, out: { bottles: 10 }, rate: 1, w: 0 },
      { id: 'makeCapsules', name: 'Mold Capsules', in: {}, cashIn: 1.2, out: { capsules: 40 }, rate: 1, w: 0 },
      { id: 'packWhole', name: 'Bag Whole Beans', in: { roasted: 0.25, packaging: 1 }, out: { wholeBean: 1 }, rate: 2, w: 1 },
      { id: 'packGround', name: 'Pack Ground Coffee', in: { ground: 0.25, packaging: 1 }, out: { groundPack: 1 }, rate: 2, w: 1 },
      { id: 'packWholesale', name: 'Pack Wholesale Bags', in: { ground: 5, boxes: 1 }, out: { wholesaleBag: 1 }, rate: 0.4, w: 0 },
      { id: 'packPremium', name: 'Blend Premium Lots', in: { roasted: 0.2, specialty: 0.1, packaging: 1 }, out: { premiumBlend: 1 }, rate: 1, w: 0, reqResearch: 'specialtyBlending' }
    ], desc: 'Makes packaging materials and packs finished retail coffee. Set recipe priorities.' },
  { id: 'equipmentFactory', name: 'Coffee Equipment Factory', cat: 'factory', sprite: 'equipment', cost: 5e8, g: 1.17, opex: 20000,
    staff: { factoryWorker: 40, factoryManager: 2 }, unlock: { rev: 2e8 },
    recipes: [ { id: 'buildMachines', name: 'Assemble Machines', in: { packaging: 10 }, cashIn: 8, out: { machines: 0.2 }, rate: 1, w: 1 } ],
    desc: 'Espresso machines and brewers for retail and wholesale.' },
  { id: 'beverageFactory', name: 'Industrial Beverage Factory', cat: 'factory', sprite: 'beverage', cost: 3e9, g: 1.17, opex: 120000,
    staff: { factoryWorker: 60, factoryManager: 3 }, unlock: { rev: 1.2e9 },
    recipes: [ { id: 'canRtd', name: 'Can Ready-to-Drink', in: { ground: 0.015, milk: 0.08, sugar: 0.01, bottles: 1 }, out: { rtd: 1 }, rate: 60, w: 1 } ],
    desc: 'Aseptic canning at 200,000 units per hour.' },
  /* --- Logistics --- */
  { id: 'localWarehouse', name: 'Local Distribution Warehouse', cat: 'logistics', sprite: 'warehouse', cost: 5000, g: 1.18, opex: 0.4,
    staff: { logisticsWorker: 1 }, storage: 1, unlock: { rev: 2000 },
    desc: 'Shelving and a loading dock. +1x base storage for every resource.' },
  { id: 'regionalWarehouse', name: 'Regional Warehouse', cat: 'logistics', sprite: 'warehouse2', cost: 250000, g: 1.18, opex: 15,
    staff: { logisticsWorker: 4 }, storage: 8, unlock: { rev: 100000 },
    desc: 'Pallet racking and forklifts. +8x base storage.' },
  { id: 'nationalDC', name: 'National Distribution Center', cat: 'logistics', sprite: 'warehouse3', cost: 2e7, g: 1.18, opex: 900,
    staff: { logisticsWorker: 20, logisticsManager: 1 }, storage: 60, unlock: { rev: 8e6 },
    desc: 'A million square feet of automated storage. +60x base storage.' },
  { id: 'vanFleet', name: 'Delivery Van Fleet', cat: 'logistics', sprite: 'van', cost: 30000, g: 1.17, opex: 2,
    staff: { driver: 2 }, transport: 20, unlock: { rev: 12000 },
    desc: 'Last-mile delivery to shops and customers. +20 u/s transport.' },
  { id: 'trucking', name: 'Trucking Company', cat: 'logistics', sprite: 'truck', cost: 1e6, g: 1.17, opex: 60,
    staff: { driver: 8, logisticsManager: 0.3 }, transport: 300, unlock: { rev: 4e5 },
    desc: 'Long-haul freight between facilities. +300 u/s transport.' },
  { id: 'cargoShip', name: 'Cargo Shipping Company', cat: 'logistics', sprite: 'ship', cost: 5e7, g: 1.17, opex: 2500,
    staff: { logisticsWorker: 20, logisticsManager: 1 }, transport: 5000, unlock: { rev: 2e7, regions: 2 },
    desc: 'Container vessels linking continents. +5,000 u/s transport.' },
  { id: 'freightAir', name: 'Freight Airline', cat: 'logistics', sprite: 'plane', cost: 2e9, g: 1.17, opex: 80000,
    staff: { logisticsWorker: 60, logisticsManager: 2 }, transport: 40000, unlock: { rev: 8e8 },
    desc: 'Overnight air freight for premium lots. +40,000 u/s transport.' },
  { id: 'globalLogistics', name: 'Global Logistics Network', cat: 'logistics', sprite: 'globe', cost: 1e11, g: 1.18, opex: 3e6,
    staff: { logisticsManager: 5, logisticsWorker: 200 }, transport: 500000, effect: 'globalLogistics', unlock: { rev: 4e10 },
    desc: 'An integrated worldwide network. Massive transport plus distribution bonuses.' },
  /* --- Retail & distribution --- */
  { id: 'onlineStore', name: 'Online Coffee Store', cat: 'distribution', sprite: 'onlinestore', cost: 50000, g: 1.16, opex: 3,
    staff: { logisticsWorker: 2 }, sells: [ { res: 'wholeBean', rate: 1.5 }, { res: 'groundPack', rate: 1.5 }, { res: 'capsulePack', rate: 0.5 } ],
    unlock: { rev: 20000 }, desc: 'Direct-to-consumer web sales of packaged coffee.' },
  { id: 'subscription', name: 'Coffee Subscription Company', cat: 'distribution', sprite: 'subscription', cost: 3e6, g: 1.16, opex: 120,
    staff: { logisticsWorker: 6, marketing: 1 }, sells: [ { res: 'premiumBlend', rate: 0.8 }, { res: 'groundPack', rate: 3 } ],
    unlock: { rev: 1.2e6, rep: 30 }, desc: 'Monthly boxes of fresh coffee. Recurring revenue.' },
  { id: 'supermarket', name: 'Supermarket Coffee Brand', cat: 'distribution', sprite: 'supermarket', cost: 4e7, g: 1.16, opex: 1800,
    staff: { logisticsWorker: 15, marketing: 2 }, sells: [ { res: 'groundPack', rate: 40 }, { res: 'wholeBean', rate: 30 }, { res: 'instantPack', rate: 30 } ],
    unlock: { rev: 1.5e7 }, desc: 'Your brand on every supermarket shelf in the country.' },
  { id: 'wholesale', name: 'Wholesale Coffee Distributor', cat: 'distribution', sprite: 'wholesale', cost: 5e8, g: 1.16, opex: 20000,
    staff: { logisticsWorker: 30, logisticsManager: 1 }, sells: [ { res: 'wholesaleBag', rate: 8 }, { res: 'groundPack', rate: 200 } ],
    unlock: { rev: 2e8 }, desc: 'Bulk contracts with hotels, offices and restaurants.' },
  { id: 'vending', name: 'Coffee Vending Network', cat: 'distribution', sprite: 'vending', cost: 6e9, g: 1.16, opex: 250000,
    staff: { logisticsWorker: 80, logisticsManager: 2 }, sells: [ { res: 'rtd', rate: 500 }, { res: 'bottled', rate: 300 } ],
    unlock: { rev: 2.5e9 }, desc: 'Fifty thousand machines in stations, hospitals and campuses.' },
  { id: 'machineRetail', name: 'Coffee Machine Retailer', cat: 'distribution', sprite: 'machineretail', cost: 8e10, g: 1.16, opex: 3e6,
    staff: { logisticsWorker: 100, marketing: 4 }, sells: [ { res: 'machines', rate: 6 }, { res: 'capsulePack', rate: 500 } ],
    unlock: { rev: 3e10 }, desc: 'Sell the machines, then sell the capsules forever.' },
  /* --- Corporate --- */
  { id: 'researchLab', name: 'Coffee Research Laboratory', cat: 'corporate', sprite: 'lab', cost: 100000, g: 1.2, opex: 6,
    staff: { researcher: 3 }, effect: 'research', rp: 0.5, unlock: { rev: 40000 },
    desc: 'Generates 0.5 Research Points/sec per lab.' },
  { id: 'marketingAgency', name: 'Marketing Agency', cat: 'corporate', sprite: 'marketing', cost: 750000, g: 1.2, opex: 40,
    staff: { marketing: 4 }, effect: 'marketing', unlock: { rev: 300000 },
    desc: 'Builds brand reputation and lifts demand company-wide.' },
  { id: 'equipMfr', name: 'Coffee Equipment Manufacturer', cat: 'corporate', sprite: 'equipmfr', cost: 2e10, g: 1.18, opex: 800000,
    staff: { factoryWorker: 300, factoryManager: 10 }, effect: 'equipMfr',
    recipes: [ { id: 'massMachines', name: 'Mass-Produce Machines', in: { packaging: 20 }, cashIn: 200, out: { machines: 5 }, rate: 1, w: 1 } ],
    unlock: { rev: 8e9 }, desc: 'Industrial machine production plus equipment synergies.' },
  { id: 'intlHolding', name: 'International Coffee Holding', cat: 'corporate', sprite: 'holding', cost: 5e11, g: 1.2, opex: 1.5e7,
    staff: { executive: 3 }, effect: 'intlHolding', unlock: { rev: 2e11, regions: 3 },
    desc: 'Holding structure for global subsidiaries. +25% international revenue each.' },
  { id: 'financial', name: 'Financial Services Division', cat: 'corporate', sprite: 'financial', cost: 8e12, g: 1.2, opex: 2e8,
    staff: { executive: 5 }, effect: 'financial', unlock: { rev: 3e12 },
    desc: 'Treasury operations: earns interest on cash and cuts operating costs.' },
  { id: 'globalCorp', name: 'Global Coffee Corporation', cat: 'corporate', sprite: 'corporation', cost: 1e15, g: 1.25, opex: 3e10,
    staff: { executive: 20 }, effect: 'globalCorp', unlock: { rev: 4e14, regions: 6 },
    desc: 'The ultimate holding company. Doubles all revenue per unit owned.' }
];
CE.BIZ = {}; CE.BUSINESSES.forEach(b => CE.BIZ[b.id] = b);
CE.BIZ_CATS = [
  { id: 'retail', name: 'Retail', icon: 'shop' },
  { id: 'farm', name: 'Agriculture', icon: 'farm' },
  { id: 'factory', name: 'Manufacturing', icon: 'roastery' },
  { id: 'logistics', name: 'Logistics', icon: 'truck' },
  { id: 'distribution', name: 'Distribution', icon: 'supermarket' },
  { id: 'corporate', name: 'Corporate', icon: 'corporation' }
];
/* ---------- Employees ---------- */
CE.STAFF = {
  barista:        { name: 'Barista',             hire: 150,    salary: 0.05, sprite: 'cup',        desc: 'Brews and serves coffee in retail locations.' },
  shopManager:    { name: 'Shop Manager',        hire: 2500,   salary: 0.5,  sprite: 'shop',       desc: 'Automates shop operations and improves throughput.' },
  farmWorker:     { name: 'Farm Worker',         hire: 200,    salary: 0.04, sprite: 'farm',       desc: 'Harvests cherries on farms and plantations.' },
  agManager:      { name: 'Agricultural Manager', hire: 8000,  salary: 0.8,  sprite: 'plantation', desc: 'Improves harvest output and cuts farm expenses.' },
  factoryWorker:  { name: 'Factory Worker',      hire: 600,    salary: 0.12, sprite: 'factory',    desc: 'Runs processing, roasting and packaging lines.' },
  factoryManager: { name: 'Factory Manager',     hire: 15000,  salary: 1.5,  sprite: 'roastery',   desc: 'Speeds manufacturing and reduces waste.' },
  logisticsWorker: { name: 'Logistics Worker',   hire: 900,    salary: 0.15, sprite: 'warehouse',  desc: 'Moves and stores inventory across the network.' },
  driver:         { name: 'Driver',              hire: 1200,   salary: 0.2,  sprite: 'truck',      desc: 'Delivers coffee to shops and customers.' },
  researcher:     { name: 'Researcher',          hire: 5000,   salary: 0.6,  sprite: 'lab',        desc: 'Generates +0.05 Research Points/sec each.' },
  marketing:      { name: 'Marketing Specialist', hire: 10000, salary: 1,    sprite: 'marketing',  desc: 'Grows brand reputation over time.' },
  executive:      { name: 'Executive',           hire: 250000, salary: 25,   sprite: 'corporation', desc: 'Cuts operating costs 1% each (max 25%) and boosts valuation.' }
};

/* ---------- Regions ---------- */
CE.REGIONS = {
  na: { name: 'North America', cost: 0,     opex: 1,    labor: 1,    demand: 1,    farm: 0.8, size: 1.2, desc: 'Your home market. Huge demand, high costs.' },
  sa: { name: 'South America', cost: 5e6,   opex: 0.6,  labor: 0.5,  demand: 0.8,  farm: 1.6, size: 0.8, desc: 'The coffee heartland. Ideal growing conditions.' },
  eu: { name: 'Europe',        cost: 5e7,   opex: 1.2,  labor: 1.4,  demand: 1.3,  farm: 0.4, size: 1.1, desc: 'Discerning espresso culture. Premium prices.' },
  af: { name: 'Africa',        cost: 5e8,   opex: 0.45, labor: 0.35, demand: 0.7,  farm: 1.8, size: 0.7, desc: 'Birthplace of coffee. Exceptional terroir.' },
  as: { name: 'Asia',          cost: 5e9,   opex: 0.7,  labor: 0.6,  demand: 1.5,  farm: 1.1, size: 1.6, desc: 'The fastest-growing coffee market on Earth.' },
  oc: { name: 'Oceania',       cost: 5e10,  opex: 1.3,  labor: 1.5,  demand: 1.25, farm: 0.7, size: 0.6, desc: 'Flat white capital of the world. Quality obsessed.' }
};
CE.REGION_ORDER = ['na', 'sa', 'eu', 'af', 'as', 'oc'];
})(typeof window !== 'undefined' ? window : globalThis);
