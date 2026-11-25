/* COFFEE EMPIRE — UI sections: Production, Locations, Farms, Research. */
(function (global) {
'use strict';
const CE = global.CE = global.CE || {};
const Big = CE.Big, E = CE.Engine, UI = CE.UI;

/* ---------- Production ---------- */
UI.sections.production = {
  render(S) {
    E.ensureMods(S);
    const autoOk = !!E.mods.unlocks.autoBuy;
    const schedOk = !!E.mods.unlocks.scheduling;
    let html = '<div class="page-head"><h2>Production Network</h2>' +
      '<p class="muted">Cherries → green beans → roasted → ground → packaged → sold. Watch for bottlenecks.</p></div>';
    const problems = CE.BUSINESSES.filter(b => E.totalOwned(S, b.id) > 0 && S.biz[b.id].bottleneck);
    html += '<div class="panel' + (problems.length ? ' warn-panel' : '') + '"><h3>' +
      (problems.length ? '⚠ Bottlenecks (' + problems.length + ')' : '✓ No bottlenecks') + '</h3>' +
      (problems.length ? problems.map(b => '<div class="news-item warn">' + b.name + ': ' + S.biz[b.id].bottleneck + '</div>').join('') :
        '<p class="muted">All facilities are running smoothly.</p>') + '</div>';
    const cats = [['raw', 'Raw Materials'], ['intermediate', 'Intermediate Goods'], ['product', 'Packaged Products']];
    for (const [cat, label] of cats) {
      html += '<div class="panel"><h3>' + label + '</h3><div class="res-table">';
      for (const id in CE.RESOURCES) {
        const r = CE.RESOURCES[id];
        if (r.cat !== cat) continue;
        const sup = S.supply[id];
        html += '<div class="res-row">' +
          '<div class="res-name"><b>' + r.name + '</b><span class="muted">(' + r.unit + ')</span></div>' +
          '<div class="res-inv"><div class="util-bar"><div class="util-fill" id="ri-' + id + '"></div></div>' +
          '<span id="rq-' + id + '"></span></div>' +
          '<div class="res-flows"><span class="pos" id="rp-' + id + '"></span><span class="neg" id="rc-' + id + '"></span></div>' +
          '<div class="res-price" id="rpr-' + id + '"></div>' +
          '<div class="res-btns">' +
          '<button class="btn small" data-action="buyres" data-id="' + id + '" data-qty="10">+10</button>' +
          '<button class="btn small" data-action="buyres" data-id="' + id + '" data-qty="100">+100</button>' +
          '<button class="btn small" data-action="buyres" data-id="' + id + '" data-qty="fill">Fill</button>' +
          '<button class="btn small" data-action="sellres" data-id="' + id + '" data-qty="all">Sell</button>' +
          '</div>' +
          '<div class="res-auto' + (autoOk ? '' : ' locked-feature') + '" title="' + (autoOk ? 'Auto-purchasing' : 'Requires research: Automatic Inventory') + '">' +
          '<label class="mini"><input type="checkbox" data-supply="' + id + ':auto"' + (sup.auto ? ' checked' : '') + (autoOk ? '' : ' disabled') + '> auto</label>' +
          '<label class="mini">min <input type="number" class="tiny" min="0" max="1" step="0.05" value="' + sup.min + '" data-supply="' + id + ':min"' + (autoOk ? '' : ' disabled') + '></label>' +
          '<label class="mini">max <input type="number" class="tiny" min="0" max="1" step="0.05" value="' + sup.max + '" data-supply="' + id + ':max"' + (autoOk ? '' : ' disabled') + '></label>' +
          '<select class="tiny" data-supply="' + id + ':supplier"' + (autoOk ? '' : ' disabled') + '>' +
          ['cheap', 'balanced', 'premium'].map(s => '<option value="' + s + '"' + (sup.supplier === s ? ' selected' : '') + '>' + s + '</option>').join('') +
          '</select></div></div>';
      }
      html += '</div></div>';
    }
    const factories = CE.BUSINESSES.filter(b => b.recipes && E.totalOwned(S, b.id) > 0);
    if (factories.length) {
      html += '<div class="panel"><h3>Facility Priorities ' +
        (schedOk ? '<span class="muted">(0 = off, 3 = top priority — capacity split by weight)</span>' :
          '<span class="muted">🔒 research Production Scheduling to edit</span>') + '</h3>';
      for (const b of factories) {
        const ov = S.recipes[b.id] || {};
        html += '<div class="facility"><b>' + b.name + ' x' + E.totalOwned(S, b.id) + '</b>' +
          ' <button class="btn small" data-action="nav" data-id="businesses" title="Facility upgrades are on the Businesses page">⬆ Upgrades</button>' +
          '<span class="muted" id="fu-' + b.id + '"></span>';
        for (const rc of b.recipes) {
          if (rc.reqResearch && !S.research.done[rc.reqResearch]) continue;
          const w = ov[rc.id] != null ? ov[rc.id] : rc.w;
          const io = Object.keys(rc.in).map(r => CE.fmtQty(rc.in[r]) + ' ' + CE.RESOURCES[r].name).join(' + ') || 'raw materials (opex)';
          const out = Object.keys(rc.out).map(r => CE.fmtQty(rc.out[r]) + ' ' + CE.RESOURCES[r].name).join(' + ');
          html += '<div class="recipe-row"><span class="recipe-io">' + io + ' → ' + out + '</span>' +
            '<span class="chip-row">' + [0, 1, 2, 3].map(p =>
              '<button class="chip tiny-chip' + (w === p ? ' active' : '') + '" data-action="recipe" data-id="' + b.id + '" data-recipe="' + rc.id + '" data-w="' + p + '">' + p + '</button>').join('') +
            '</span></div>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    return html;
  },
  update(S) {
    E.ensureMods(S);
    const flow = E.flow || { prod: {}, cons: {} };
    for (const id in CE.RESOURCES) {
      const cap = E.caps[id];
      const set = (pid, v) => { const el = document.getElementById(pid); if (el) el.textContent = v; };
      const fill = document.getElementById('ri-' + id);
      if (fill) fill.style.width = Math.min(100, S.resources[id] / cap * 100) + '%';
      set('rq-' + id, CE.fmtQty(S.resources[id]) + ' / ' + CE.fmtQty(cap));
      set('rp-' + id, '+' + CE.fmtQty(flow.prod[id] || 0) + '/s');
      set('rc-' + id, '-' + CE.fmtQty(flow.cons[id] || 0) + '/s');
      const rpEl = document.getElementById('rp-' + id), rcEl = document.getElementById('rc-' + id);
      if (rpEl) rpEl.title = CE.fmtQty((flow.prod[id] || 0) * 3600) + ' per hour';
      if (rcEl) rcEl.title = CE.fmtQty((flow.cons[id] || 0) * 3600) + ' per hour';
      set('rpr-' + id, CE.fmtMoney(E.buyPrice(S, id)) + '/' + CE.RESOURCES[id].unit);
    }
    for (const b of CE.BUSINESSES) {
      const el = document.getElementById('fu-' + b.id);
      if (el) el.textContent = ' — ' + CE.fmtPct(S.biz[b.id].util, 0) + ' utilization' +
        (S.biz[b.id].bottleneck ? ' ⚠ ' + S.biz[b.id].bottleneck : '');
    }
  }
};

/* ---------- Locations ---------- */
UI.sections.locations = {
  render(S) {
    E.ensureMods(S);
    let html = '<div class="page-head"><h2>International Locations</h2>' +
      '<p class="muted">Expand into new regions, then buy businesses there via the region selector on the Businesses page.</p></div><div class="biz-grid">';
    for (const r of CE.REGION_ORDER) {
      const def = CE.REGIONS[r];
      const open = S.regions[r] && S.regions[r].unlocked;
      let bizCount = 0;
      for (const b of CE.BUSINESSES) bizCount += S.biz[b.id].regions[r] || 0;
      html += '<div class="biz-card' + (open ? '' : ' locked') + '"><div class="biz-top">' +
        CE.spriteImg('globe', 'biz-sprite' + (open ? '' : ' dim'), 64) +
        '<div class="biz-title"><h4>' + def.name + '</h4><p class="biz-desc">' + def.desc + '</p></div></div>' +
        '<div class="biz-stats">' +
        '<span>Operating costs <b>x' + def.opex + '</b></span>' +
        '<span>Labor costs <b>x' + def.labor + '</b></span>' +
        '<span>Demand <b>x' + def.demand + '</b></span>' +
        '<span>Farm yield <b>x' + def.farm + '</b></span>' +
        '<span>Market size <b>x' + def.size + '</b></span>' +
        '<span>Businesses here <b>' + bizCount + '</b></span></div>' +
        '<div class="biz-bottom">' +
        (open ? '<button class="btn small' + (S.selectedRegion === r ? ' primary' : '') + '" data-action="setregion" data-id="' + r + '">' +
          (S.selectedRegion === r ? '✓ Buying here' : 'Buy here') + '</button>' +
          (S.regions[r].division ? '<span class="pos">✓ Division (+25% revenue)</span>' :
            '<button class="btn small" data-action="division" data-id="' + r + '">Establish division — ' + CE.fmtMoney(E.divisionCost(S, r)) + '</button>') :
          '<button class="btn primary" data-action="unlockregion" data-id="' + r + '">Expand — ' + CE.fmtMoney(E.regionCost(S, r)) + '</button>') +
        '</div></div>';
    }
    return html + '</div>';
  },
  update(S) {
    document.querySelectorAll('[data-action="unlockregion"]').forEach(btn => {
      btn.classList.toggle('cant', E.regionCost(S, btn.dataset.id).gt(S.cash));
    });
  }
};
/* ---------- Farms ---------- */
UI.sections.farms = {
  render(S) {
    E.ensureMods(S);
    let html = '<div class="page-head"><h2>Farms &amp; Plantations</h2>' +
      '<p class="muted">Agricultural operations feed your chain with fresh cherries and specialty lots.</p></div>' +
      '<div class="stat-grid">' +
      '<div class="stat-card"><span class="stat-label">Cherries harvested</span><b class="stat-value" id="fm-beans">—</b></div>' +
      '<div class="stat-card"><span class="stat-label">Arabica cherries</span><b class="stat-value" id="fm-ca">—</b></div>' +
      '<div class="stat-card"><span class="stat-label">Robusta cherries</span><b class="stat-value" id="fm-cr">—</b></div>' +
      '<div class="stat-card"><span class="stat-label">Specialty beans</span><b class="stat-value" id="fm-sp">—</b></div></div>' +
      '<div class="panel"><h3>Farm Staff</h3><div class="chip-row">' +
      '<button class="btn small" data-action="hire" data-id="farmWorker" data-n="10">Hire 10 farm workers — ' + CE.fmtMoney(E.hireCost(S, 'farmWorker', 10)) + '</button>' +
      '<button class="btn small" data-action="hire" data-id="agManager" data-n="1">Hire ag manager — ' + CE.fmtMoney(E.hireCost(S, 'agManager', 1)) + '</button>' +
      '<span class="muted">More on the Staff page.</span></div></div><div class="biz-grid">';
    const discoveredFarms = CE.BUSINESSES.filter(b => b.cat === 'farm' && S.discovered[b.id]);
    for (const b of discoveredFarms) html += UI.bizCard(S, b);
    if (!discoveredFarms.length) html += '<div class="panel"><p class="muted">No agricultural businesses discovered yet. Keep growing your revenue to discover farms.</p></div>';
    return html + '</div>';
  },
  update(S) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('fm-beans', CE.fmtQty(S.stats.beans, 'kg'));
    set('fm-ca', CE.fmtQty(S.resources.cherryA, 'kg'));
    set('fm-cr', CE.fmtQty(S.resources.cherryR, 'kg'));
    set('fm-sp', CE.fmtQty(S.resources.specialty, 'kg'));
    for (const b of CE.BUSINESSES) {
      if (b.cat === 'farm' && document.getElementById('biz-' + b.id)) UI.updateBizCard(S, b);
    }
  }
};

/* ---------- Research ---------- */
UI.sections.research = {
  render(S) {
    let html = '<div class="page-head"><h2>Research &amp; Development</h2>' +
      '<div class="chip-row"><b id="rs-rp">' + CE.fmtQty(S.rp) + ' RP</b>' +
      '<span class="muted">Earn RP from labs, researchers, sales and achievements. Research continues offline.</span></div></div>';
    if (S.research.active) {
      const r = CE.RESEARCH_MAP[S.research.active.id];
      html += '<div class="panel"><h3>Active: ' + r.name + '</h3>' +
        '<div class="util-bar big-bar"><div class="util-fill" id="rs-progress"></div></div>' +
        '<span class="muted" id="rs-eta"></span></div>';
    }
    if (S.research.queue.length) {
      html += '<div class="panel"><h3>Queue</h3><div class="chip-row">' +
        S.research.queue.map(id => '<span class="chip">' + CE.RESEARCH_MAP[id].name + '</span>').join('') + '</div></div>';
    }
    html += '<div class="research-tree">';
    const cats = CE.RESEARCH_CATS.filter(c => S.researchCatsUnlocked.indexOf(c) >= 0);
    if (!cats.length) html += '<p class="muted">No research categories unlocked yet.</p>';
    for (const cat of cats) {
      html += '<div class="research-col"><h4>' + cat + '</h4>';
      for (const r of CE.RESEARCH.filter(x => x.cat === cat)) {
        const done = !!S.research.done[r.id];
        const active = S.research.active && S.research.active.id === r.id;
        const queued = S.research.queue.indexOf(r.id) >= 0;
        const reqOk = r.req.every(q => S.research.done[q]);
        const cls = done ? 'done' : active ? 'active' : queued ? 'queued' : reqOk ? 'available' : 'locked';
        html += '<div class="research-node ' + cls + '"><b>' + (done ? '✓ ' : active ? '⏳ ' : queued ? '⌛ ' : reqOk ? '' : '🔒 ') + r.name + '</b>' +
          '<p>' + r.desc + '</p>' +
          '<div class="research-meta"><span>' + r.cost + ' RP</span><span>' + CE.fmtTime(r.time) + '</span></div>' +
          (!done && !active && !queued && reqOk ?
            '<button class="btn small' + (S.rp < r.cost ? ' cant' : '') + '" data-action="research" data-id="' + r.id + '">Research</button>' : '') +
          (!reqOk && !done ? '<p class="muted req">Requires: ' + r.req.map(q => CE.RESEARCH_MAP[q].name).join(', ') + '</p>' : '') +
          '</div>';
      }
      html += '</div>';
    }
    return html + '</div>';
  },
  update(S) {
    const rp = document.getElementById('rs-rp');
    if (rp) rp.textContent = CE.fmtQty(S.rp) + ' RP';
    if (S.research.active) {
      const r = CE.RESEARCH_MAP[S.research.active.id];
      const pct = Math.min(1, S.research.active.progress / r.time);
      const fill = document.getElementById('rs-progress');
      if (fill) fill.style.width = Math.round(pct * 100) + '%';
      const speed = 1 + 0.25 * (S.legacy.upgrades.lg_research || 0);
      const eta = document.getElementById('rs-eta');
      if (eta) eta.textContent = CE.fmtPct(pct, 0) + ' — ' + CE.fmtTime((r.time - S.research.active.progress) / speed) + ' remaining';
    }
    document.querySelectorAll('[data-action="research"]').forEach(btn => {
      btn.classList.toggle('cant', S.rp < CE.RESEARCH_MAP[btn.dataset.id].cost);
    });
  }
};
})(typeof window !== 'undefined' ? window : globalThis);
