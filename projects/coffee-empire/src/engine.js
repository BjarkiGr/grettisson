/* COFFEE EMPIRE — centralized simulation engine.
   One tick function drives production, economy, markets, events, research,
   competitors and achievements. Offline progression reuses the same tick
   in large chunks so bottlenecks and costs are respected. */
(function (global) {
'use strict';
const CE = global.CE = global.CE || {};
const Big = CE.Big;

CE.notifications = [];
CE.notify = function (msg, kind) {
  CE.notifications.push({ msg, kind: kind || 'info', t: Date.now() });
  if (CE.notifications.length > 60) CE.notifications.shift();
};

const E = CE.Engine = {
  dirty: true, mods: null, needs: null, eff: null, caps: null, transport: 0,
  acc: { market: 0, comp: 0, hist: 0, ach: 0 },
  invalidate() { this.dirty = true; }
};

const MOD_DEFAULTS = () => ({
  farmMult: 1, factoryMult: 1, retailMult: 1, retailRevMult: 1, distMult: 1, distRevMult: 1,
  transportMult: 1, storageMult: 1, opexMult: 1, wageMult: 1, demandMult: 1, buyPriceMult: 1,
  rpMult: 1, brandGrowth: 1, manualMult: 1, beanUseMult: 1, inputUseMult: 1, intlMult: 1,
  logisticsOpexMult: 1, farmStaffMult: 1, specialtyMult: 1, valuationMult: 1, acquireCostMult: 1,
  expandCostMult: 1, interestMult: 1, elasticityBonus: 1, supplierAvail: 1,
  qualityBonus: 0, staffFloor: 0.3, offlineCapH: 0, interestRate: 0, revenueMult: 1, brewSpeed: 1,
  marketBeans: 1, marketMilk: 1, marketSugar: 1, marketCocoa: 1, marketPackaging: 1, marketFuel: 1, marketElectricity: 1,
  unlocks: {}, bizMult: {}
});

function applyEffect(m, ef, level) {
  level = level || 1;
  if (ef.kind === 'combo') { ef.effects.forEach(e => applyEffect(m, e, level)); return; }
  if (ef.kind === 'biz') { m.bizMult[ef.biz] = (m.bizMult[ef.biz] || 1) * Math.pow(ef.mult, level); return; }
  if (ef.kind === 'unlock') { m.unlocks[ef.key] = true; return; }
  if (ef.kind === 'mod') {
    if (ef.mult != null) m[ef.key] = (m[ef.key] != null ? m[ef.key] : 1) * Math.pow(ef.mult, level);
    if (ef.add != null) m[ef.key] = (m[ef.key] != null ? m[ef.key] : 0) + ef.add * level;
    if (ef.set != null) m[ef.key] = Math.max(m[ef.key] || 0, ef.set);
  }
}

E.computeMods = function (S) {
  const m = MOD_DEFAULTS();
  for (const id in S.upgrades) { const u = CE.UPGRADE_MAP[id]; if (u) applyEffect(m, u.effect); }
  for (const id in S.repeatables) { const u = CE.REPEATABLE_MAP[id]; if (u && S.repeatables[id] > 0) applyEffect(m, u.effect, S.repeatables[id]); }
  for (const id in S.research.done) { const r = CE.RESEARCH_MAP[id]; if (r) r.effects.forEach(ef => applyEffect(m, ef)); }
  for (const ev of S.events.active) {
    const def = CE.EVENT_MAP[ev.id];
    if (def) def.effects.forEach(ef => { m[ef.key] = (m[ef.key] != null ? m[ef.key] : 1) * ef.mult; });
  }
  for (const c of S.campaigns) {
    const def = CE.CAMPAIGNS.find(x => x.id === c.id);
    if (def) m.demandMult *= def.demand;
  }
  for (const id in S.acquisitions) {
    const a = CE.ACQUISITIONS.find(x => x.id === id);
    if (a && a.bonus) m[a.bonus.key] *= a.bonus.mult;
  }
  /* Legacy permanent bonuses */
  const L = S.legacy.upgrades;
  m.farmMult *= 1 + 0.25 * (L.lg_production || 0);
  m.factoryMult *= 1 + 0.25 * (L.lg_production || 0);
  m.retailMult *= 1 + 0.25 * (L.lg_production || 0);
  m.distMult *= 1 + 0.25 * (L.lg_production || 0);
  m.revenueMult *= 1 + 0.2 * (L.lg_revenue || 0);
  m.opexMult *= Math.pow(0.95, L.lg_opex || 0);
  m.offlineCapH += 6 * (L.lg_offline || 0);
  m.manualMult *= Math.pow(2, L.lg_equipment || 0);
  /* Achievements: +1% revenue each */
  m.revenueMult *= 1 + 0.01 * Object.keys(S.achievements).length;
  /* Brand recognition milestones: +10% demand at 25/50/75/100 reputation */
  m.demandMult *= 1 + 0.1 * Math.floor(S.brand / 25);
  /* Corporate business effects — require operational staff (or full automation). */
  const owned = id => E.totalOwned(S, id);
  const act = t => S.staff[t].n > 0 || m.unlocks.autoCorporate;
  const agn = owned('agSupply');
  if (agn > 0 && act('agManager')) m.farmMult *= 1 + 0.1 * Math.pow(agn, 0.7);
  const gln = owned('globalLogistics');
  if (gln > 0 && act('logisticsWorker')) m.distRevMult *= 1 + 0.05 * gln;
  const man = owned('marketingAgency');
  if (man > 0 && act('marketing')) { m.brandGrowth *= 1 + 0.25 * man; m.demandMult *= 1 + 0.02 * Math.min(man, 50); }
  const ihn = owned('intlHolding');
  if (ihn > 0 && act('executive')) m.intlMult *= 1 + 0.25 * ihn;
  const fin = owned('financial');
  if (fin > 0 && act('executive')) { m.opexMult *= 1 - 0.02 * Math.min(fin, 15); m.interestRate = 0.00002 * Math.min(fin, 25) * m.interestMult; }
  const emn = owned('equipMfr');
  if (emn > 0 && act('executive')) m.distRevMult *= Math.pow(1.02, Math.min(emn, 100));
  const gcn = owned('globalCorp');
  if (gcn > 0 && act('executive')) m.revenueMult *= Math.pow(2, Math.min(gcn, 100)) * (gcn > 100 ? 1 + 0.5 * (gcn - 100) : 1);
  const execs = S.staff.executive.n;
  if (execs > 0) m.opexMult *= 1 - 0.01 * Math.min(execs, 25);
  this.mods = m;
  return m;
};

E.totalOwned = function (S, id) {
  const b = S.biz[id]; let n = 0;
  for (const r in b.regions) n += b.regions[r];
  return n;
};
E.regionCount = function (S) { return CE.REGION_ORDER.filter(r => S.regions[r] && S.regions[r].unlocked).length; };
E.computeStaff = function (S) {
  const needs = {};
  for (const t in CE.STAFF) needs[t] = 0;
  for (const b of CE.BUSINESSES) {
    const n = E.totalOwned(S, b.id);
    if (!n || !b.staff) continue;
    for (const t in b.staff) {
      let per = b.staff[t];
      if (b.cat === 'farm' && (t === 'farmWorker' || t === 'agManager')) per *= this.mods.farmStaffMult;
      needs[t] += n * per;
    }
  }
  /* Gradual automation: an unstaffed business produces NOTHING unless its
     category automation has been explicitly unlocked through research. */
  const AUTO_KEY = {
    barista: 'autoRetail', shopManager: 'autoRetail',
    farmWorker: 'autoFarms', agManager: 'autoFarms',
    factoryWorker: 'autoFactory', factoryManager: 'autoFactory',
    logisticsWorker: 'autoLogistics', driver: 'autoLogistics',
    researcher: 'autoCorporate', marketing: 'autoCorporate', executive: 'autoCorporate'
  };
  const eff = {};
  for (const t in CE.STAFF) {
    const st = S.staff[t];
    const ratio = needs[t] > 0 ? Math.min(1, st.n / needs[t]) : (st.n > 0 ? 1 : 0);
    let base;
    if (st.n > 0) base = 0.3 + 0.7 * Math.pow(ratio, 0.7);
    else base = this.mods.unlocks[AUTO_KEY[t]] ? Math.max(0.5, this.mods.staffFloor) : 0;
    eff[t] = { ratio, mult: base * (1 + Math.min(1, st.xp) * 0.5) };
  }
  this.needs = needs; this.eff = eff;
};

E.computeCaps = function (S) {
  let storageUnits = 0, transport = 0;
  for (const b of CE.BUSINESSES) {
    const n = E.totalOwned(S, b.id);
    if (!n) continue;
    if (b.storage) storageUnits += n * b.storage;
    if (b.transport) transport += n * b.transport;
  }
  const caps = {};
  for (const id in CE.RESOURCES) caps[id] = CE.RESOURCES[id].cap * (1 + storageUnits) * this.mods.storageMult;
  this.caps = caps;
  /* Transport requires drivers/logistics staff (or logistics automation).
     Warehouse storage is passive infrastructure and always available. */
  this.transport = transport * this.mods.transportMult *
    Math.max(this.eff.driver.mult, this.eff.logisticsWorker.mult);
};

/* Current market price of a resource ($/unit). */
E.resPrice = function (S, id) {
  const r = CE.RESOURCES[id];
  let f = 1;
  if (r.commodity) f = S.markets[r.commodity].factor * (this.mods['market' + r.commodity[0].toUpperCase() + r.commodity.slice(1)] || 1);
  return r.price * f;
};
E.buyPrice = function (S, id) {
  const sup = S.supply[id].supplier;
  const supMult = sup === 'cheap' ? 0.85 : sup === 'premium' ? 1.2 : 1;
  return E.resPrice(S, id) * this.mods.buyPriceMult * supMult;
};

/* Is a business type visible/unlocked for purchase? */
E.bizUnlocked = function (S, b) {
  const u = b.unlock;
  if (!u) return true;
  if (u.rev != null && !S.stats.revenue.gteNum(u.rev)) return false;
  if (u.rep != null && S.brand < u.rep) return false;
  if (u.regions != null && E.regionCount(S) < u.regions) return false;
  if (u.research && !S.research.done[u.research]) return false;
  if (u.biz && E.totalOwned(S, u.biz[0]) < u.biz[1]) return false;
  return true;
};
E.upgradeAvailable = function (S, u) {
  if (S.upgrades[u.id]) return false;
  const r = u.req;
  if (!r) return true;
  if (r.rev != null && !S.stats.revenue.gteNum(r.rev)) return false;
  if (r.biz && E.totalOwned(S, r.biz[0]) < r.biz[1]) return false;
  if (r.research && !S.research.done[r.research]) return false;
  if (r.milestone && !S.milestones[r.milestone]) return false;
  return true;
};
E.drinkAvailable = function (S, id) {
  const d = CE.DRINKS[id];
  if (!S.recipesUnlocked[id]) return false;
  return !d.reqResearch || !!S.research.done[d.reqResearch];
};

/* Company valuation / net worth. */
E.valuation = function (S) {
  let v = S.cash.clone();
  for (const b of CE.BUSINESSES) {
    const n = E.totalOwned(S, b.id);
    if (n) v = v.add(CE.costAt(b.cost, b.g, n).mulNum(n * 0.5));
  }
  for (const id in S.resources) v = v.add(Big.fromNumber(S.resources[id] * E.resPrice(S, id)));
  for (const sub of S.subsidiaries) v = v.add(sub.val);
  v = v.add(Big.fromNumber(S.brand * S.brand * 1000));
  return v.mulNum(this.mods ? this.mods.valuationMult : 1);
};

/* Snapshot for achievement conditions. */
E.snapshot = function (S) {
  const owned = {}, catOwned = { retail: 0, farm: 0, factory: 0, logistics: 0, distribution: 0, corporate: 0 };
  let totalBiz = 0, typesOwned = 0, staff = 0, upgrades = 0;
  for (const b of CE.BUSINESSES) {
    const n = E.totalOwned(S, b.id);
    owned[b.id] = n;
    if (n > 0) { catOwned[b.cat] += n; totalBiz += n; typesOwned++; }
  }
  for (const t in S.staff) staff += S.staff[t].n;
  upgrades = Object.keys(S.upgrades).length + Object.values(S.repeatables).reduce((a, b) => a + b, 0);
  const worth = E.valuation(S);
  return {
    owned, catOwned, totalBiz, typesOwned, staff, upgrades, worth,
    cups: S.stats.cups, beans: S.stats.beans, products: S.stats.products,
    research: Object.keys(S.research.done).length,
    regions: E.regionCount(S), share: E.marketShare(S)
  };
};

E.marketShare = function (S) {
  let player = S.rates.rev.toNumber();
  for (const sub of S.subsidiaries) player += sub.rev;
  if (!isFinite(player)) return 1; /* beyond Number range: you dominate the market */
  let total = player;
  for (const c of S.competitors) if (!c.acquired) total += c.rev;
  return total > 0 ? Math.min(1, player / total) : 0;
};
/* ---------- Main tick ---------- */
E.tick = function (S, dt, offline) {
  if (dt <= 0) return { rev: Big.ZERO, exp: Big.ZERO };
  if (this.dirty || !this.mods) {
    this.computeMods(S); this.computeStaff(S); this.computeCaps(S); this.dirty = false;
  }
  if (!offline) E.updateBrew(S, dt); /* manual brewing never progresses offline */
  const m = this.mods, eff = this.eff, caps = this.caps, inv = S.resources;
  S.time += dt; S.stats.playtime += dt;
  const acc = { rev: Big.ZERO, exp: Big.ZERO, cogs: Big.ZERO, opex: Big.ZERO, wages: Big.ZERO };
  const flowP = {}, flowC = {};
  const addP = (r, x) => { flowP[r] = (flowP[r] || 0) + x; };
  const addC = (r, x) => { flowC[r] = (flowC[r] || 0) + x; };
  const bizRev = {}; /* per-business revenue this tick for lifetime profit */
  const addBizRev = (id, big) => { bizRev[id] = (bizRev[id] || Big.ZERO).add(big); };
  const milestoneCache = {};
  const milestone = id => milestoneCache[id] != null ? milestoneCache[id] : (milestoneCache[id] = CE.milestoneMult(E.totalOwned(S, id)));
  const fuelF = S.markets.fuel.factor * m.marketFuel;
  const elecF = Math.sqrt(S.markets.electricity.factor * m.marketElectricity);
  const brandFactor = 0.6 + S.brand / 100 * 0.9;
  const share = E.marketShare(S);
  const compF = 0.85 + 0.15 * (1 - share);

  /* Wages + experience */
  for (const t in CE.STAFF) {
    const st = S.staff[t];
    if (st.n > 0) {
      const w = Big.fromNumber(st.n * CE.STAFF[t].salary * m.wageMult * dt);
      acc.exp = acc.exp.add(w); acc.wages = acc.wages.add(w);
      st.xp = Math.min(1, st.xp + dt * 0.0005 * eff[t].ratio);
    }
  }

  /* Distribution transport budget (shared across all channels) */
  let distDesired = 0;
  if (!m.unlocks.autoDist) {
    for (const b of CE.BUSINESSES) {
      if (!b.sells) continue;
      const n = E.totalOwned(S, b.id);
      if (!n) continue;
      const bm = (m.bizMult[b.id] || 1) * milestone(b.id);
      for (const s of b.sells) distDesired += s.rate * n * m.distMult * bm * eff.logisticsWorker.mult * dt;
    }
  }
  const distFactor = m.unlocks.autoDist || distDesired <= 0 ? 1 : Math.min(1, this.transport * dt / distDesired);

  /* Businesses by region */
  for (const r of CE.REGION_ORDER) {
    if (!S.regions[r] || !S.regions[r].unlocked) continue;
    const region = CE.REGIONS[r];
    /* International multiplier plus regional division bonus (+25%). */
    const intl = (r === 'na' ? 1 : m.intlMult) * (S.regions[r].division ? 1.25 : 1);
    for (const b of CE.BUSINESSES) {
      const n = S.biz[b.id].regions[r] || 0;
      if (!n) continue;
      const bm = (m.bizMult[b.id] || 1) * milestone(b.id);
      const st = S.biz[b.id];
      let opex = n * b.opex * region.opex * m.opexMult * dt;
      let util = 1, bottleneck = '';
      if (st.paused) {
        /* Paused facilities pay half rent and produce nothing. */
        const half = Big.fromNumber(opex * 0.5);
        acc.exp = acc.exp.add(half); acc.opex = acc.opex.add(half);
        st.util = 0; st.bottleneck = 'Paused';
        continue;
      }

      if (b.cat === 'farm') {
        const agR = eff.agManager.ratio;
        opex *= 1 - 0.1 * agR;
        const mF = m.farmMult * region.farm * eff.farmWorker.mult * (1 + 0.15 * agR) * bm;
        let wanted = 0, made = 0;
        for (const res in b.out) {
          let want = b.out[res] * n * mF * dt;
          if (res === 'specialty') want *= m.specialtyMult;
          const room = Math.max(0, caps[res] - inv[res]);
          const got = Math.min(want, room);
          inv[res] += got; addP(res, got);
          wanted += want; made += got;
          if (b.out[res] > 0 && res.indexOf('cherry') === 0) S.stats.beans += got;
          if (got < want * 0.99) bottleneck = 'Storage full (' + CE.RESOURCES[res].name + ')';
        }
        util = wanted > 0 ? made / wanted : 1;
      } else if (b.recipes) {
        const ov = S.recipes[b.id] || {};
        const recipes = b.recipes.filter(rc => !rc.reqResearch || S.research.done[rc.reqResearch]);
        let sumW = 0;
        const weights = recipes.map(rc => { const w = ov[rc.id] != null ? ov[rc.id] : rc.w; sumW += w; return w; });
        const mF = m.factoryMult * bm * eff.factoryWorker.mult * (1 + 0.15 * eff.factoryManager.ratio);
        let utilSum = 0, wSum = 0;
        for (let i = 0; i < recipes.length; i++) {
          const rc = recipes[i], w = weights[i];
          if (w <= 0 || sumW <= 0) continue;
          const cycles = rc.rate * n * mF * dt * (w / sumW);
          let scale = 1;
          for (const res in rc.in) {
            const need = rc.in[res] * cycles * m.inputUseMult;
            if (need > 0) {
              const s = inv[res] / need;
              if (s < scale) { scale = s; bottleneck = 'Missing ' + CE.RESOURCES[res].name; }
            }
          }
          for (const res in rc.out) {
            const out = rc.out[res] * cycles;
            const room = Math.max(0, caps[res] - inv[res]);
            if (out > 0 && room / out < scale) { scale = room / out; bottleneck = 'Storage full (' + CE.RESOURCES[res].name + ')'; }
          }
          /* Raw materials bought with cash (COGS) — nothing is created from nothing. */
          if (rc.cashIn) {
            const cashNeed = rc.cashIn * cycles;
            if (cashNeed > 0) {
              const availCash = Math.max(0, S.cash.add(acc.rev).sub(acc.exp).toNumber());
              if (availCash / cashNeed < scale) { scale = availCash / cashNeed; bottleneck = 'No cash for raw materials'; }
            }
          }
          scale = Math.max(0, Math.min(1, scale));
          if (rc.cashIn && scale > 0) {
            const matCost = Big.fromNumber(rc.cashIn * cycles * scale);
            acc.exp = acc.exp.add(matCost); acc.cogs = acc.cogs.add(matCost);
          }
          for (const res in rc.in) { const used = rc.in[res] * cycles * m.inputUseMult * scale; inv[res] -= used; addC(res, used); }
          for (const res in rc.out) {
            const made = rc.out[res] * cycles * scale;
            inv[res] += made; addP(res, made);
            if (CE.RESOURCES[res].cat === 'product') S.stats.products += made;
          }
          utilSum += scale * w; wSum += w;
        }
        util = wSum > 0 ? utilSum / wSum : 0;
        opex *= (0.4 + 0.6 * util) * elecF;
      } else if (b.cat === 'logistics') {
        opex *= fuelF * m.logisticsOpexMult;
      }
      else if (b.cat === 'retail') {
        const menu = b.menu.filter(d => E.drinkAvailable(S, d));
        /* Without a shop manager the player supervises manually: 60% throughput.
           Managers (or Regional Management research) unlock full automation. */
        const mgmt = (eff.shopManager.ratio > 0 || m.unlocks.regionalMgmt) ? 1 : 0.6;
        const capacity = b.cups * n * m.retailMult * bm * eff.barista.mult * mgmt * (1 + 0.1 * eff.shopManager.ratio) * dt;
        const quality = b.quality + m.qualityBonus;
        const qualF = Math.max(0.7, Math.min(1.6, 0.7 + 0.3 * quality));
        const per = capacity / Math.max(1, menu.length);
        const sales = []; const need = {};
        let demandSum = 0;
        for (const d of menu) {
          const drink = CE.DRINKS[d];
          const pm = S.prices[d] || 1;
          const priceF = Math.pow(pm, -drink.elastic * m.elasticityBonus);
          const demandF = Math.min(1, region.demand * brandFactor * m.demandMult * compF * priceF * qualF);
          demandSum += demandF;
          const cups = per * demandF;
          sales.push({ d, cups, pm });
          for (const res in drink.recipe) {
            const use = drink.recipe[res] * cups * ((res === 'roasted' || res === 'specialty' || res === 'ground') ? m.beanUseMult : 1);
            need[res] = (need[res] || 0) + use;
          }
        }
        let scale = 1;
        for (const res in need) {
          if (need[res] > 0 && inv[res] / need[res] < scale) { scale = inv[res] / need[res]; bottleneck = 'Out of ' + CE.RESOURCES[res].name; }
        }
        scale = Math.max(0, Math.min(1, scale));
        let cupsTotal = 0, value = 0;
        for (const s of sales) {
          const cups = s.cups * scale;
          const drink = CE.DRINKS[s.d];
          for (const res in drink.recipe) {
            const use = drink.recipe[res] * cups * ((res === 'roasted' || res === 'specialty' || res === 'ground') ? m.beanUseMult : 1);
            inv[res] -= use; addC(res, use);
          }
          cupsTotal += cups;
          value += cups * drink.price * s.pm * (b.priceMult || 1);
        }
        const rev = Big.fromNumber(value).mulNum(m.retailRevMult * intl * m.revenueMult);
        acc.rev = acc.rev.add(rev); addBizRev(b.id, rev);
        S.stats.cups += cupsTotal; S.stats.customers += cupsTotal;
        const avgDemand = menu.length ? demandSum / menu.length : 0;
        util = scale * avgDemand;
        if (!bottleneck && avgDemand < 0.5) bottleneck = 'Low demand (pricing/brand)';
        opex *= elecF;
        S.rp += cupsTotal * 0.002 * m.rpMult;
      } else if (b.sells) {
        const demandF = Math.min(1, brandFactor * m.demandMult * region.demand);
        let value = 0, unitsTotal = 0;
        for (const s of b.sells) {
          const want = s.rate * n * m.distMult * bm * eff.logisticsWorker.mult * dt * distFactor * demandF;
          const got = Math.min(want, inv[s.res]);
          inv[s.res] -= got; addC(s.res, got);
          value += got * E.resPrice(S, s.res);
          unitsTotal += got;
          if (got < want * 0.99) bottleneck = inv[s.res] <= 0.01 ? 'No ' + CE.RESOURCES[s.res].name + ' to sell' : 'Transport capacity';
        }
        const rev = Big.fromNumber(value).mulNum(m.distRevMult * intl * m.revenueMult);
        acc.rev = acc.rev.add(rev); addBizRev(b.id, rev);
        S.stats.customers += unitsTotal;
        util = unitsTotal > 0 ? 1 : 0;
      } else if (b.cat === 'corporate') {
        if (b.effect === 'research') S.rp += b.rp * n * m.rpMult * eff.researcher.mult * dt;
      }

      if (util <= 0 && !bottleneck) {
        if (b.cat === 'retail') bottleneck = eff.barista.mult <= 0 ? 'Closed — needs baristas' : 'No demand';
        else if (b.cat === 'farm') bottleneck = 'Closed — needs farm workers';
        else if (b.recipes) bottleneck = 'Closed — needs factory workers';
        else if (b.sells) bottleneck = eff.logisticsWorker.mult <= 0 ? 'Closed — needs logistics workers' : 'Nothing to sell';
      }
      acc.exp = acc.exp.add(Big.fromNumber(opex)); acc.opex = acc.opex.add(Big.fromNumber(opex));
      st.util = util; st.bottleneck = bottleneck;
    }
  }
  /* Per-business lifetime profit + reporting rates (revenue minus own opex share). */
  for (const b of CE.BUSINESSES) {
    const st = S.biz[b.id];
    const n = E.totalOwned(S, b.id);
    if (n > 0) {
      const ownOpex = b.opex * n * m.opexMult * dt * (st.paused ? 0.5 : 1);
      const rev = bizRev[b.id] || Big.ZERO;
      st.lifetime = st.lifetime.add(rev).sub(Big.fromNumber(ownOpex));
      st.revRate = rev.divNum(dt);
      st.opexRate = ownOpex / dt;
    } else { st.revRate = Big.ZERO; st.opexRate = 0; }
  }
  /* Automatic purchasing */
  if (m.unlocks.autoBuy) {
    for (const id in CE.RESOURCES) {
      const sup = S.supply[id];
      if (!sup.auto) continue;
      const cap = caps[id];
      if (inv[id] >= sup.min * cap) continue;
      const price = E.buyPrice(S, id);
      if (price <= 0) continue;
      const supAvail = (sup.supplier === 'cheap' ? 0.5 : sup.supplier === 'premium' ? 1.5 : 1) * m.supplierAvail;
      const maxRate = cap * 0.05 * supAvail * dt;
      let qty = Math.min(sup.max * cap - inv[id], maxRate);
      const affordable = S.cash.add(acc.rev).sub(acc.exp).toNumber() / price;
      qty = Math.max(0, Math.min(qty, affordable));
      if (qty <= 0) continue;
      const cost = Big.fromNumber(qty * price);
      inv[id] += qty; addP(id, qty);
      acc.exp = acc.exp.add(cost); acc.cogs = acc.cogs.add(cost);
    }
  }

  /* Financial services interest + subsidiary income */
  if (m.interestRate > 0) {
    const gain = S.cash.mulNum(m.interestRate * dt);
    acc.rev = acc.rev.add(gain);
  }
  for (const sub of S.subsidiaries) {
    acc.rev = acc.rev.add(Big.fromNumber(sub.rev * dt).mulNum(m.revenueMult));
    sub.rev *= 1 + 0.00005 * dt;
    sub.val = sub.val.mulNum(1 + 0.00005 * dt);
  }

  /* Brand reputation */
  const specialists = S.staff.marketing.n;
  const growth = (0.002 + specialists * 0.01) * m.brandGrowth;
  S.brand = Math.max(0, Math.min(100, S.brand + growth * dt - S.brand * 0.0005 * dt));

  /* Research points trickle + active research progress */
  S.rp += (0.1 + S.staff.researcher.n * 0.05) * m.rpMult * dt;
  const speed = 1 + 0.25 * (S.legacy.upgrades.lg_research || 0);
  if (S.research.active) {
    const r = CE.RESEARCH_MAP[S.research.active.id];
    S.research.active.progress += dt * speed;
    if (S.research.active.progress >= r.time) {
      S.research.done[r.id] = true;
      S.research.active = null;
      CE.notify('Research complete: ' + r.name, 'good');
      this.dirty = true;
      while (S.research.queue.length && !S.research.active) {
        const next = CE.RESEARCH_MAP[S.research.queue.shift()];
        if (next && !S.research.done[next.id] && next.req.every(q => S.research.done[q])) {
          S.research.active = { id: next.id, progress: 0 };
        }
      }
    }
  }

  /* Commodity markets (every 5s of game time) */
  this.acc.market += dt;
  while (this.acc.market >= 5) {
    this.acc.market -= 5;
    for (const c in CE.COMMODITIES) {
      const mk = S.markets[c];
      mk.prev = mk.factor;
      mk.factor += mk.factor * (Math.random() - 0.5) * 0.06 + (1 - mk.factor) * 0.02;
      mk.factor = Math.max(0.3, Math.min(4, mk.factor));
      const h = S.marketHistory[c];
      h.push(mk.factor);
      if (h.length > 120) h.shift();
    }
  }

  /* Economic events */
  for (let i = S.events.active.length - 1; i >= 0; i--) {
    if (S.time >= S.events.active[i].ends) {
      const def = CE.EVENT_MAP[S.events.active[i].id];
      S.events.active.splice(i, 1);
      this.dirty = true;
      if (def) CE.notify('Event ended: ' + def.name, 'info');
    }
  }
  S.events.timer -= dt;
  if (S.events.timer <= 0) {
    S.events.timer = 90 + Math.random() * 150;
    if (S.events.active.length < 3) E.triggerEvent(S);
  }

  /* Competitors (every 5s) */
  this.acc.comp += dt;
  while (this.acc.comp >= 5) {
    this.acc.comp -= 5;
    const war = S.events.active.some(e => e.id === 'priceWar');
    for (const c of S.competitors) {
      if (c.acquired) continue;
      const def = CE.COMPETITORS.find(x => x.id === c.id);
      const g = 1 + def.growth * 5 * (war ? 2 : 1);
      c.val = c.val.mulNum(g);
      c.rev *= g;
    }
  }
  /* Campaign expiry */
  for (let i = S.campaigns.length - 1; i >= 0; i--) {
    if (S.time >= S.campaigns[i].ends) { S.campaigns.splice(i, 1); this.dirty = true; }
  }

  /* History samples (every 5s) */
  this.acc.hist += dt;
  if (this.acc.hist >= 5) {
    this.acc.hist = 0;
    const worth = E.valuation(S);
    const rps = acc.rev.divNum(dt), pps = acc.rev.sub(acc.exp).divNum(dt);
    /* Production volume: cups + packaged products per second since last sample */
    let prod = 0;
    if (this.lastSample) {
      const span = Math.max(1e-9, S.time - this.lastSample.t);
      prod = ((S.stats.cups - this.lastSample.cups) + (S.stats.products - this.lastSample.products)) / span;
    }
    this.lastSample = { t: S.time, cups: S.stats.cups, products: S.stats.products };
    S.history.push({ t: S.time, rev: rps, profit: pps, worth, cash: S.cash.clone(), prod });
    if (S.history.length > 288) S.history.shift();
    if (rps.gt(S.stats.bestRps)) S.stats.bestRps = rps;
    if (worth.gt(S.stats.bestWorth)) S.stats.bestWorth = worth;
  }

  /* Achievements (every 1s) */
  this.acc.ach += dt;
  if (this.acc.ach >= 1) {
    this.acc.ach = 0;
    const H = E.snapshot(S);
    for (const a of CE.ACHIEVEMENTS) {
      if (S.achievements[a.id]) continue;
      let ok = false;
      try { ok = a.cond(S, H); } catch (e) { ok = false; }
      if (ok) {
        S.achievements[a.id] = Date.now();
        S.rp += a.rp || 0;
        CE.notify('🏆 Achievement: ' + a.name + (a.rp ? ' (+' + a.rp + ' RP)' : ''), 'good');
        this.dirty = true;
      }
    }
    E.checkDiscovery(S);
    E.checkMilestones(S, H);
  }

  /* Finalize finances */
  const profit = acc.rev.sub(acc.exp);
  S.cash = S.cash.add(profit);
  if (S.cash.m < 0) S.cash = Big.ZERO;
  S.stats.revenue = S.stats.revenue.add(acc.rev);
  S.stats.runRevenue = S.stats.runRevenue.add(acc.rev);
  S.stats.expenses = S.stats.expenses.add(acc.exp);
  S.stats.cogs = S.stats.cogs.add(acc.cogs);
  S.stats.opex = S.stats.opex.add(acc.opex);
  S.stats.wages = S.stats.wages.add(acc.wages);
  S.rates = {
    rev: acc.rev.divNum(dt), exp: acc.exp.divNum(dt), profit: profit.divNum(dt),
    cogs: acc.cogs.divNum(dt), opex: acc.opex.divNum(dt), wages: acc.wages.divNum(dt)
  };
  E.flow = { prod: {}, cons: {} };
  for (const r in flowP) E.flow.prod[r] = flowP[r] / dt;
  for (const r in flowC) E.flow.cons[r] = flowC[r] / dt;
  return { rev: acc.rev, exp: acc.exp };
};

E.triggerEvent = function (S) {
  const pool = CE.EVENTS.filter(e => !S.events.active.some(a => a.id === e.id));
  if (!pool.length) return null;
  let total = 0; pool.forEach(e => total += e.weight);
  let roll = Math.random() * total, def = pool[0];
  for (const e of pool) { roll -= e.weight; if (roll <= 0) { def = e; break; } }
  const dur = def.dur[0] + Math.random() * (def.dur[1] - def.dur[0]);
  S.events.active.push({ id: def.id, ends: S.time + dur });
  S.events.log.unshift({ id: def.id, t: S.time, name: def.name, good: def.good });
  if (S.events.log.length > 30) S.events.log.pop();
  S.stats.events++;
  if (def.special === 'bankruptcy') {
    const alive = S.competitors.filter(c => !c.acquired);
    if (alive.length) {
      const victim = alive[Math.floor(Math.random() * alive.length)];
      victim.rev *= 0.25; victim.val = victim.val.mulNum(0.5);
    }
  } else if (def.special === 'brandBoost') {
    S.brand = Math.min(100, S.brand + 10);
  }
  this.dirty = true;
  CE.notify((def.good ? '📈 ' : '📉 ') + def.name + ' — ' + def.desc, def.good ? 'good' : 'warn');
  return def;
};

/* ---------- Offline progression ----------
   Chunked simulation (never per-second): respects inputs, storage, costs. */
E.simulateOffline = function (S, seconds) {
  const m = this.mods || this.computeMods(S);
  const capH = 12 + m.offlineCapH;
  const capped = Math.min(seconds, capH * 3600);
  const eff = Math.min(1, 0.75 + 0.05 * (S.legacy.upgrades.lg_offline || 0));
  const before = {
    rev: S.stats.revenue, exp: S.stats.expenses, cups: S.stats.cups,
    beans: S.stats.beans, products: S.stats.products,
    research: Object.keys(S.research.done).length, events: S.stats.events
  };
  const chunks = Math.max(1, Math.min(240, Math.ceil(capped / 300)));
  const dt = capped / chunks;
  let rev = Big.ZERO, exp = Big.ZERO;
  const quiet = CE.notifications.length;
  for (let i = 0; i < chunks; i++) {
    const r = E.tick(S, dt, true);
    rev = rev.add(r.rev); exp = exp.add(r.exp);
  }
  /* Offline efficiency bonus applies to revenue; expenses were fully paid. */
  const bonus = rev.mulNum(eff - 1); /* negative adjustment */
  S.cash = S.cash.add(bonus);
  if (S.cash.m < 0) S.cash = Big.ZERO;
  S.stats.offlineCollects++;
  const summary = {
    seconds: capped, realSeconds: seconds, capped: seconds > capped, eff,
    revenue: rev.mulNum(eff), expenses: exp, profit: rev.mulNum(eff).sub(exp),
    cups: S.stats.cups - before.cups, beans: S.stats.beans - before.beans,
    products: S.stats.products - before.products,
    researchDone: Object.keys(S.research.done).length - before.research,
    events: S.stats.events - before.events,
    notifications: CE.notifications.length - quiet
  };
  return summary;
};
/* ---------- Player actions ---------- */
E.ensureMods = function (S) { if (this.dirty || !this.mods) { this.computeMods(S); this.computeStaff(S); this.computeCaps(S); this.dirty = false; } };

/* Payment + stats for a completed manual sale (ingredients already consumed). */
E.manualSale = function (S, drinkId, cups) {
  E.ensureMods(S);
  const drink = CE.DRINKS[drinkId], m = this.mods;
  const rev = Big.fromNumber(cups * drink.price * (S.prices[drinkId] || 1)).mulNum(m.retailRevMult * m.revenueMult);
  S.cash = S.cash.add(rev);
  S.stats.revenue = S.stats.revenue.add(rev); S.stats.runRevenue = S.stats.runRevenue.add(rev);
  S.stats.cups += cups; S.stats.customers += cups; S.stats.clicks++;
  S.rp += 0.02 * m.rpMult;
  const hr = new Date().getHours();
  if (hr >= 2 && hr < 4) S.stats.nightBrew = true;
  S.biz.cart.lifetime = S.biz.cart.lifetime.add(rev);
  return rev;
};
/* All-in-one manual sale primitive (serve-step finalizer & headless tests). */
E.brew = function (S, drinkId) {
  E.ensureMods(S);
  const drink = CE.DRINKS[drinkId];
  if (!drink || !E.drinkAvailable(S, drinkId)) return null;
  const m = this.mods;
  const cups = m.manualMult;
  for (const res in drink.recipe) {
    const need = drink.recipe[res] * cups * ((res === 'roasted' || res === 'specialty' || res === 'ground') ? m.beanUseMult : 1);
    if (S.resources[res] < need) { CE.notify('Not enough ' + CE.RESOURCES[res].name + ' to brew!', 'warn'); return null; }
  }
  for (const res in drink.recipe) {
    S.resources[res] -= drink.recipe[res] * cups * ((res === 'roasted' || res === 'specialty' || res === 'ground') ? m.beanUseMult : 1);
  }
  const rev = E.manualSale(S, drinkId, cups);
  return { cups, rev };
};
/* ---------- Interactive brew session (state machine, saved in S) ---------- */
E.brewSelect = function (S, drinkId) {
  if (!E.drinkAvailable(S, drinkId)) return false;
  if (S.brewSession && S.brewSession.running) return false;
  E.ensureMods(S);
  S.brewSession = { drink: drinkId, step: 0, running: false, t: 0, dur: 0, cups: E.mods.manualMult };
  return true;
};
E.stepDuration = function (S, step) {
  E.ensureMods(S);
  const u = E.mods.unlocks;
  if (step === 'grind' && u.grinder) return 0;
  if (step === 'steam' && u.milkSteamer) return 0;
  let d = CE.BREW_STEPS[step].dur;
  if ((step === 'prep' || step === 'brew') && u.proMachine) d *= 0.5;
  if (step === 'steep' && u.coldBrewKit) d *= 0.5;
  return d / (E.mods.brewSpeed || 1);
};
E.brewStepIngredients = function (S, drinkId, step, cups) {
  E.ensureMods(S);
  const recipe = CE.DRINKS[drinkId].recipe, out = {};
  const bean = r => r === 'roasted' || r === 'specialty' || r === 'ground';
  for (const r in recipe) {
    if (step === 'grind' && bean(r)) out[r] = recipe[r] * cups * E.mods.beanUseMult;
    else if ((step === 'brew' || step === 'steep') && !bean(r) && r !== 'milk') out[r] = recipe[r] * cups;
    else if (step === 'steam' && r === 'milk') out[r] = recipe[r] * cups;
  }
  return out;
};
E.brewStartStep = function (S) {
  const ses = S.brewSession;
  if (!ses || ses.running) return false;
  const step = CE.DRINKS[ses.drink].steps[ses.step];
  if (!step) return false;
  E.ensureMods(S);
  const need = E.brewStepIngredients(S, ses.drink, step, ses.cups);
  for (const r in need) {
    if (S.resources[r] < need[r] - 1e-12) { CE.notify('Not enough ' + CE.RESOURCES[r].name + '!', 'warn'); return false; }
  }
  for (const r in need) S.resources[r] = Math.max(0, S.resources[r] - need[r]);
  const dur = E.stepDuration(S, step);
  if (dur <= 0) { E.brewFinishStep(S); return true; }
  ses.running = true; ses.t = 0; ses.dur = dur;
  return true;
};
E.brewFinishStep = function (S) {
  const ses = S.brewSession;
  if (!ses) return;
  const drink = CE.DRINKS[ses.drink];
  const step = drink.steps[ses.step];
  ses.running = false; ses.t = 0; ses.dur = 0;
  if (step === 'serve') {
    const rev = E.manualSale(S, ses.drink, ses.cups);
    CE.notify('Served ' + CE.fmtQty(ses.cups) + 'x ' + drink.name + ' — +' + CE.fmtMoney(rev), 'good');
    ses.step = 0;
    ses.cups = E.mods.manualMult;
  } else ses.step++;
};
E.updateBrew = function (S, dt) {
  const ses = S.brewSession;
  if (!ses || !ses.running) return;
  ses.t += dt;
  if (ses.t >= ses.dur) E.brewFinishStep(S);
};
E.brewCancel = function (S) { S.brewSession = null; };
/* ---------- Discovery & milestones ---------- */
E.checkDiscovery = function (S) {
  for (const b of CE.BUSINESSES) {
    if (!S.discovered[b.id] && E.bizUnlocked(S, b)) {
      S.discovered[b.id] = true;
      E.dirty = true;
      CE.notify('🔎 Discovered: ' + b.name + ' — now available in Businesses!', 'good');
    }
  }
};
E.completeMilestone = function (S, m, silent) {
  S.milestones[m.id] = Date.now();
  if (silent) return;
  const r = m.rewards || {}, parts = [];
  (r.recipes || []).forEach(id => { S.recipesUnlocked[id] = true; parts.push('recipe: ' + CE.DRINKS[id].name); });
  (r.staff || []).forEach(id => { S.staffUnlocked[id] = true; parts.push('hiring: ' + CE.STAFF[id].name); });
  (r.discover || []).forEach(id => { if (!S.discovered[id]) { S.discovered[id] = true; parts.push('discovered: ' + CE.BIZ[id].name); } });
  (r.cats || []).forEach(c => { if (S.researchCatsUnlocked.indexOf(c) < 0) { S.researchCatsUnlocked.push(c); parts.push('research: ' + c); } });
  (r.features || []).forEach(f => { S.features[f] = true; parts.push('feature: ' + f); });
  if (r.rp) { S.rp += r.rp; parts.push('+' + r.rp + ' RP'); }
  if (r.cash) { S.cash = S.cash.add(Big.fromNumber(r.cash)); parts.push('+' + CE.fmtMoney(r.cash)); }
  E.dirty = true;
  CE.notify('🏁 Milestone: ' + m.name + (parts.length ? ' — ' + parts.join(', ') : ''), 'good');
};
E.checkMilestones = function (S, H) {
  for (const m of CE.MILESTONES) {
    if (S.milestones[m.id]) continue;
    let v = 0;
    try { v = m.metric(S, H); } catch (e) { v = 0; }
    if (v >= m.target) E.completeMilestone(S, m, false);
  }
};
/* Legacy saves: mark already-met milestones complete without re-granting rewards. */
E.backfillMilestones = function (S) {
  E.ensureMods(S);
  const H = E.snapshot(S);
  for (const m of CE.MILESTONES) {
    if (S.milestones[m.id]) continue;
    let v = 0;
    try { v = m.metric(S, H); } catch (e) { v = 0; }
    if (v >= m.target) E.completeMilestone(S, m, true);
  }
};

E.buyBiz = function (S, id, qty, region) {
  E.ensureMods(S);
  const b = CE.BIZ[id];
  region = region || S.selectedRegion;
  /* Once discovered, a business stays purchasable even if conditions lapse. */
  if (!b || !S.discovered[id] || !S.regions[region] || !S.regions[region].unlocked) return 0;
  const owned = E.totalOwned(S, id);
  let count = qty === 'max' ? CE.maxAffordable(b.cost, b.g, owned, S.cash) : qty;
  if (count <= 0) return 0;
  let cost = CE.costFor(b.cost, b.g, owned, count);
  if (cost.gt(S.cash)) {
    count = CE.maxAffordable(b.cost, b.g, owned, S.cash);
    if (count <= 0) return 0;
    cost = CE.costFor(b.cost, b.g, owned, count);
  }
  S.cash = S.cash.sub(cost);
  S.biz[id].regions[region] = (S.biz[id].regions[region] || 0) + count;
  this.dirty = true;
  CE.notify('Purchased ' + count + 'x ' + b.name + ' for ' + CE.fmtMoney(cost), 'good');
  return count;
};

E.buyResource = function (S, id, qty) {
  E.ensureMods(S);
  const cap = this.caps[id];
  const price = E.buyPrice(S, id);
  let n = qty === 'fill' ? cap - S.resources[id] : qty;
  n = Math.min(n, cap - S.resources[id]);
  n = Math.min(n, S.cash.toNumber() / price);
  n = Math.max(0, Math.floor(n * 100) / 100);
  if (n <= 0) return 0;
  const cost = Big.fromNumber(n * price);
  S.cash = S.cash.sub(cost);
  S.resources[id] += n;
  S.stats.expenses = S.stats.expenses.add(cost); S.stats.cogs = S.stats.cogs.add(cost);
  return n;
};
E.sellResource = function (S, id, qty) {
  E.ensureMods(S);
  const n = Math.min(qty === 'all' ? S.resources[id] : qty, S.resources[id]);
  if (n <= 0) return 0;
  const rev = Big.fromNumber(n * E.resPrice(S, id) * 0.8);
  S.resources[id] -= n;
  S.cash = S.cash.add(rev);
  S.stats.revenue = S.stats.revenue.add(rev); S.stats.runRevenue = S.stats.runRevenue.add(rev);
  return n;
};

/* Flat hire cost: wages are the ongoing balance lever, and late-game
   businesses legitimately require thousands of employees. */
E.hireCost = function (S, type, n) { return Big.fromNumber(CE.STAFF[type].hire * n); };
E.hire = function (S, type, n) {
  if (!S.staffUnlocked[type]) { CE.notify('This employee type is not unlocked yet — check Milestones.', 'warn'); return 0; }
  const cost = E.hireCost(S, type, n);
  if (cost.gt(S.cash)) return 0;
  S.cash = S.cash.sub(cost);
  S.staff[type].n += n;
  E.dirty = true;
  CE.notify('Hired ' + n + 'x ' + CE.STAFF[type].name, 'good');
  return n;
};
E.fire = function (S, type, n) {
  n = Math.min(n, S.staff[type].n);
  S.staff[type].n -= n;
  E.dirty = true;
  return n;
};

E.buyUpgrade = function (S, id) {
  const u = CE.UPGRADE_MAP[id];
  if (!u || !E.upgradeAvailable(S, u)) return false;
  const cost = Big.fromNumber(u.cost);
  if (cost.gt(S.cash)) return false;
  S.cash = S.cash.sub(cost);
  S.upgrades[id] = 1;
  E.dirty = true;
  CE.notify('Upgrade purchased: ' + u.name, 'good');
  return true;
};
E.repeatableCost = function (S, id) {
  const u = CE.REPEATABLE_MAP[id];
  return Big.fromNumber(u.cost * Math.pow(u.costMult, S.repeatables[id] || 0));
};
E.buyRepeatable = function (S, id) {
  const cost = E.repeatableCost(S, id);
  if (cost.gt(S.cash)) return false;
  S.cash = S.cash.sub(cost);
  S.repeatables[id] = (S.repeatables[id] || 0) + 1;
  E.dirty = true;
  return true;
};

E.startResearch = function (S, id) {
  const r = CE.RESEARCH_MAP[id];
  if (!r || S.research.done[id]) return false;
  if (S.researchCatsUnlocked.indexOf(r.cat) < 0) return false;
  if (S.research.active && S.research.active.id === id) return false;
  if (S.research.queue.indexOf(id) >= 0) return false;
  if (!r.req.every(q => S.research.done[q])) return false;
  if (S.rp < r.cost) return false;
  S.rp -= r.cost;
  if (!S.research.active) S.research.active = { id, progress: 0 };
  else if (S.research.queue.length < 5) S.research.queue.push(id);
  else { S.rp += r.cost; return false; }
  CE.notify('Research started: ' + r.name, 'info');
  return true;
};
E.togglePause = function (S, id) {
  S.biz[id].paused = !S.biz[id].paused;
  CE.notify((S.biz[id].paused ? 'Paused ' : 'Resumed ') + CE.BIZ[id].name, 'info');
  return S.biz[id].paused;
};
E.brandTier = function (S) {
  return S.brand >= 100 ? 'Iconic' : S.brand >= 75 ? 'Famous' : S.brand >= 50 ? 'Popular' : S.brand >= 25 ? 'Known' : 'Emerging';
};
E.divisionCost = function (S, r) {
  E.ensureMods(S);
  return Big.fromNumber(Math.max(5e7, CE.REGIONS[r].cost * 2)).mulNum(this.mods.expandCostMult);
};
E.establishDivision = function (S, r) {
  if (!S.regions[r] || !S.regions[r].unlocked || S.regions[r].division) return false;
  const cost = E.divisionCost(S, r);
  if (cost.gt(S.cash)) return false;
  S.cash = S.cash.sub(cost);
  S.regions[r].division = true;
  E.dirty = true;
  CE.notify('Regional division established in ' + CE.REGIONS[r].name + ' (+25% regional revenue)', 'good');
  return true;
};
E.mergeCost = function (S) {
  let v = Big.ZERO;
  for (const sub of S.subsidiaries) v = v.add(sub.val);
  return v.mulNum(0.01);
};
E.mergeSubsidiaries = function (S) {
  if (S.subsidiaries.length < 2) return false;
  const cost = E.mergeCost(S);
  if (cost.gt(S.cash)) return false;
  S.cash = S.cash.sub(cost);
  let rev = 0, val = Big.ZERO;
  for (const sub of S.subsidiaries) { rev += sub.rev; val = val.add(sub.val); }
  S.subsidiaries = [{ name: 'Coffee Empire International', rev: rev * 1.1, val }];
  E.dirty = true;
  CE.notify('Subsidiaries merged into Coffee Empire International (+10% revenue)', 'good');
  return true;
};

E.setPrice = function (S, drink, v) { S.prices[drink] = Math.max(0.5, Math.min(2.5, v)); };
E.setSupply = function (S, id, patch) { Object.assign(S.supply[id], patch); };
E.setRecipe = function (S, bizId, recipeId, w) {
  E.ensureMods(S);
  if (!this.mods.unlocks.scheduling) { CE.notify('Research "Production Scheduling" to control recipe priorities.', 'warn'); return false; }
  if (!S.recipes[bizId]) S.recipes[bizId] = {};
  S.recipes[bizId][recipeId] = Math.max(0, Math.min(3, w));
  return true;
};

E.regionCost = function (S, r) {
  E.ensureMods(S);
  return Big.fromNumber(CE.REGIONS[r].cost).mulNum(this.mods.expandCostMult);
};
E.unlockRegion = function (S, r) {
  if (S.regions[r] && S.regions[r].unlocked) return false;
  const cost = E.regionCost(S, r);
  if (cost.gt(S.cash)) return false;
  S.cash = S.cash.sub(cost);
  S.regions[r] = { unlocked: true };
  E.dirty = true;
  CE.notify('Expanded into ' + CE.REGIONS[r].name + '!', 'good');
  return true;
};

E.campaignCost = function (S, id) {
  const def = CE.CAMPAIGNS.find(c => c.id === id);
  return Big.fromNumber(def.baseCost).add(S.stats.revenue.mulNum(def.scale));
};
E.runCampaign = function (S, id) {
  const def = CE.CAMPAIGNS.find(c => c.id === id);
  if (!def || S.campaigns.some(c => c.id === id)) return false;
  const cost = E.campaignCost(S, id);
  if (cost.gt(S.cash)) return false;
  S.cash = S.cash.sub(cost);
  S.stats.expenses = S.stats.expenses.add(cost);
  S.campaigns.push({ id, ends: S.time + def.dur });
  S.brand = Math.min(100, S.brand + def.brand);
  E.dirty = true;
  CE.notify('Campaign launched: ' + def.name, 'good');
  return true;
};

E.acquireCost = function (S, id) {
  E.ensureMods(S);
  const a = CE.ACQUISITIONS.find(x => x.id === id);
  return Big.fromNumber(a.cost).mulNum(this.mods.acquireCostMult);
};
E.acquireTarget = function (S, id) {
  E.ensureMods(S);
  if (!this.mods.unlocks.acquisitions || S.acquisitions[id]) return false;
  const a = CE.ACQUISITIONS.find(x => x.id === id);
  const cost = E.acquireCost(S, id);
  if (cost.gt(S.cash)) return false;
  S.cash = S.cash.sub(cost);
  S.acquisitions[id] = true;
  for (const bizId in a.grants) S.biz[bizId].regions.na = (S.biz[bizId].regions.na || 0) + a.grants[bizId];
  S.stats.acquisitions++;
  E.dirty = true;
  CE.notify('Acquired ' + a.name + '!', 'good');
  return true;
};
E.competitorCost = function (S, id) {
  E.ensureMods(S);
  const c = S.competitors.find(x => x.id === id);
  return c.val.mulNum(1.2 * this.mods.acquireCostMult);
};
E.acquireCompetitor = function (S, id) {
  E.ensureMods(S);
  if (!this.mods.unlocks.acquisitions) return false;
  const c = S.competitors.find(x => x.id === id);
  if (!c || c.acquired) return false;
  const cost = E.competitorCost(S, id);
  if (cost.gt(S.cash)) return false;
  S.cash = S.cash.sub(cost);
  c.acquired = true;
  const def = CE.COMPETITORS.find(x => x.id === id);
  S.subsidiaries.push({ name: def.name, rev: c.rev, val: c.val.clone() });
  S.stats.acquisitions++;
  E.dirty = true;
  CE.notify('Acquired competitor ' + def.name + ' — now a subsidiary!', 'good');
  return true;
};

/* ---------- Legacy / prestige ---------- */
E.prestigeGain = function (S) {
  const base = Math.sqrt(Math.max(0, S.stats.runRevenue.toNumber() / 1e9));
  return Math.floor(base * (1 + 0.1 * (S.legacy.upgrades.lg_earn || 0)));
};
E.prestige = function (S) {
  const gain = E.prestigeGain(S);
  if (gain < 1) return null;
  const keep = {
    legacy: S.legacy, achievements: S.achievements, stats: S.stats,
    settings: S.settings, createdAt: S.createdAt,
    /* Progression knowledge persists across restructures (prestige QoL). */
    milestones: S.milestones, discovered: S.discovered, staffUnlocked: S.staffUnlocked,
    recipesUnlocked: S.recipesUnlocked, researchCatsUnlocked: S.researchCatsUnlocked,
    features: S.features
  };
  const fresh = CE.newState();
  fresh.legacy = keep.legacy;
  fresh.achievements = keep.achievements;
  fresh.stats = keep.stats;
  fresh.settings = keep.settings;
  fresh.createdAt = keep.createdAt;
  fresh.milestones = keep.milestones;
  fresh.discovered = keep.discovered;
  fresh.staffUnlocked = keep.staffUnlocked;
  fresh.recipesUnlocked = keep.recipesUnlocked;
  fresh.researchCatsUnlocked = keep.researchCatsUnlocked;
  fresh.features = keep.features;
  fresh.legacy.points += gain;
  fresh.legacy.lifetimeEarned += gain;
  fresh.legacy.prestiges++;
  CE.applyLegacyStart(fresh);
  E.dirty = true;
  E.lastSample = null;
  CE.notify('Corporation restructured! +' + gain + ' Legacy Points', 'good');
  return { state: fresh, gain };
};
E.legacyCost = function (S, id) {
  const u = CE.LEGACY_MAP[id];
  const lvl = S.legacy.upgrades[id] || 0;
  return Math.ceil(u.baseCost * Math.pow(u.costMult, lvl));
};
E.buyLegacy = function (S, id) {
  const u = CE.LEGACY_MAP[id];
  const lvl = S.legacy.upgrades[id] || 0;
  if (lvl >= u.max) return false;
  const cost = E.legacyCost(S, id);
  if (S.legacy.points < cost) return false;
  S.legacy.points -= cost;
  S.legacy.upgrades[id] = lvl + 1;
  E.dirty = true;
  CE.notify('Legacy upgrade: ' + u.name + ' Lv.' + (lvl + 1), 'good');
  return true;
};

/* Dynamic objectives for the dashboard: nearest incomplete milestones. */
E.objectives = function (S) {
  E.ensureMods(S);
  const H = E.snapshot(S);
  const pending = [];
  for (const m of CE.MILESTONES) {
    if (S.milestones[m.id]) continue;
    let v = 0;
    try { v = m.metric(S, H); } catch (e) { v = 0; }
    pending.push({ m, p: Math.min(1, v / m.target), v });
  }
  pending.sort((a, b) => b.p - a.p);
  const out = pending.slice(0, 4).map(x => ({
    text: x.m.name, progress: x.p,
    detail: CE.fmtQty(x.v) + ' / ' + CE.fmtQty(x.m.target) + ' — ' + x.m.desc
  }));
  if (E.prestigeGain(S) >= 1) out.push({ text: 'LEGACY ready: restructure for ' + E.prestigeGain(S) + ' points', detail: 'Corporate tab' });
  return out.slice(0, 4);
};
})(typeof window !== 'undefined' ? window : globalThis);
