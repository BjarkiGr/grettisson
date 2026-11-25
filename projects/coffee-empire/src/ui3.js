/* COFFEE EMPIRE — UI sections: Markets, Corporate, Achievements, Statistics. */
(function (global) {
'use strict';
const CE = global.CE = global.CE || {};
const Big = CE.Big, E = CE.Engine, UI = CE.UI;

/* ---------- Markets ---------- */
UI.sections.markets = {
  tick: 0,
  render(S) {
    let html = '<div class="page-head"><h2>Commodity Markets</h2>' +
      '<p class="muted">Prices drift with supply, demand and world events. Fuel drives logistics costs; electricity drives utilities.</p></div><div class="market-grid">';
    for (const c in CE.COMMODITIES) {
      html += '<div class="market-card"><div class="market-head"><b>' + CE.COMMODITIES[c].name + '</b>' +
        '<span id="mt-' + c + '" class="trend"></span></div>' +
        '<div class="market-price"><b id="mp-' + c + '"></b><span class="muted" id="mc-' + c + '"></span></div>' +
        '<canvas class="spark" id="mk-' + c + '" width="220" height="56"></canvas></div>';
    }
    html += '</div>';
    /* Product pricing */
    html += '<div class="panel"><h3>Product Pricing</h3>' +
      '<p class="muted">Higher prices raise margins but reduce demand. Premium drinks tolerate higher prices.</p><div class="price-grid">';
    for (const d in CE.DRINKS) {
      if (!E.drinkAvailable(S, d)) continue;
      const drink = CE.DRINKS[d];
      const pm = S.prices[d] || 1;
      html += '<div class="price-row"><b>' + drink.name + '</b>' +
        '<input type="range" min="0.5" max="2.5" step="0.05" value="' + pm + '" data-price="' + d + '">' +
        '<span class="price-val" id="price-lbl-' + d + '">' + Math.round(pm * 100) + '%</span>' +
        '<span class="muted" id="price-abs-' + d + '">' + CE.fmtMoney(drink.price * pm) + '</span></div>';
    }
    html += '</div></div>';
    /* Event log */
    html += '<div class="panel"><h3>Economic Event Log</h3><div id="mk-events"></div></div>';
    return html;
  },
  update(S) {
    this.tick++;
    for (const c in CE.COMMODITIES) {
      const mk = S.markets[c];
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      const change = mk.prev ? (mk.factor / mk.prev - 1) : 0;
      set('mp-' + c, (mk.factor * 100).toFixed(1));
      const mc = document.getElementById('mc-' + c);
      if (mc) {
        mc.textContent = ' (' + (change >= 0 ? '+' : '') + (change * 100).toFixed(2) + '%)';
        mc.className = change >= 0 ? 'pos' : 'neg';
      }
      const trend = mk.factor > 1.15 ? '▲ high' : mk.factor < 0.85 ? '▼ low' : '— stable';
      set('mt-' + c, trend);
      if (this.tick % 4 === 1) {
        const cv = document.getElementById('mk-' + c);
        if (cv) UI.lineChart(cv, S.marketHistory[c], mk.factor >= 1 ? '#7a8b5c' : '#b5484d',
          { fill: 'rgba(122,139,92,0.15)', fmt: v => (v * 100).toFixed(0) });
      }
    }
    for (const d in CE.DRINKS) {
      const el = document.getElementById('price-abs-' + d);
      if (el) el.textContent = CE.fmtMoney(CE.DRINKS[d].price * (S.prices[d] || 1));
    }
    const ev = document.getElementById('mk-events');
    if (ev && this.tick % 4 === 1) {
      ev.innerHTML = S.events.log.map(e =>
        '<div class="news-item ' + (e.good ? 'good' : 'warn') + '">' + (e.good ? '📈 ' : '📉 ') + e.name +
        ' <span class="muted">at ' + CE.fmtTime(e.t) + '</span></div>').join('') || '<p class="muted">No events yet.</p>';
    }
  }
};
/* ---------- Corporate ---------- */
UI.sections.corporate = {
  render(S) {
    E.ensureMods(S);
    const acqOk = !!E.mods.unlocks.acquisitions;
    let html = '<div class="page-head"><h2>Corporate</h2></div>' +
      '<div class="stat-grid">' +
      '<div class="stat-card"><span class="stat-label">Company valuation</span><b class="stat-value" id="cp-val">—</b></div>' +
      '<div class="stat-card"><span class="stat-label">Global market share</span><b class="stat-value" id="cp-share">—</b></div>' +
      '<div class="stat-card"><span class="stat-label">Subsidiaries</span><b class="stat-value" id="cp-subs">—</b></div>' +
      '<div class="stat-card"><span class="stat-label">Acquisitions</span><b class="stat-value">' + S.stats.acquisitions + '</b></div></div>' +
      '<div class="panel"><h3>Market Share</h3><div class="share-bar" id="cp-sharebar"></div>' +
      '<div class="chip-row" id="cp-sharelegend"></div></div>';
    /* Campaigns (unlocked by the "Getting the Word Out" milestone) */
    if (S.features.campaigns) {
      html += '<div class="panel"><h3>Marketing Campaigns</h3><div class="upgrade-grid">';
      for (const c of CE.CAMPAIGNS) {
        const active = S.campaigns.find(x => x.id === c.id);
        const cost = E.campaignCost(S, c.id);
        html += '<div class="upgrade-card"><b>📣 ' + c.name + '</b><p>' + c.desc + ' Also +' + c.brand + ' reputation.</p>' +
          (active ? '<span class="pos">Active — ' + CE.fmtTime(active.ends - S.time) + ' left</span>' :
            '<button class="btn small' + (cost.gt(S.cash) ? ' cant' : '') + '" data-action="campaign" data-id="' + c.id + '">' + CE.fmtMoney(cost) + '</button>') +
          '</div>';
      }
      html += '</div></div>';
    } else {
      html += '<div class="panel"><h3>Marketing Campaigns</h3><p class="muted">🔒 Reach $5,000 lifetime revenue (milestone "Getting the Word Out") to unlock campaigns.</p></div>';
    }
    /* Competitors */
    html += '<div class="panel"><h3>Competitors ' + (acqOk ? '' : '<span class="muted">🔒 research Acquisitions to buy rivals</span>') + '</h3><div class="biz-grid">';
    for (const c of S.competitors) {
      const def = CE.COMPETITORS.find(x => x.id === c.id);
      html += '<div class="biz-card' + (c.acquired ? ' owned-sub' : '') + '"><div class="biz-top">' +
        CE.spriteImg(def.sprite, 'biz-sprite', 64) +
        '<div class="biz-title"><h4>' + def.name + (c.acquired ? ' ✓' : '') + '</h4>' +
        '<p class="biz-desc">' + def.style + ' · quality x' + def.quality + '</p></div></div>' +
        '<div class="biz-stats">' +
        '<span>Valuation <b id="cv-' + c.id + '"></b></span>' +
        '<span>Revenue <b id="cr-' + c.id + '"></b></span></div>' +
        '<div class="biz-bottom">' +
        (c.acquired ? '<span class="pos">Your subsidiary</span>' :
          '<button class="btn small' + (acqOk ? '' : ' cant') + '" data-action="acquirecomp" data-id="' + c.id + '" id="ca-' + c.id + '"' + (acqOk ? '' : ' disabled') + '>Acquire</button>') +
        '</div></div>';
    }
    html += '</div></div>';
    /* Acquisition targets */
    html += '<div class="panel"><h3>Acquisition Targets</h3><div class="upgrade-grid">';
    for (const a of CE.ACQUISITIONS) {
      const owned = !!S.acquisitions[a.id];
      const grants = Object.keys(a.grants).map(k => a.grants[k] + 'x ' + CE.BIZ[k].name).join(', ');
      html += '<div class="upgrade-card' + (owned ? ' done-card' : '') + '"><b>' + a.name + (owned ? ' ✓' : '') + '</b>' +
        '<p>' + a.desc + '</p><p class="muted">Grants: ' + grants + '</p>' +
        (owned ? '<span class="pos">Acquired</span>' :
          '<button class="btn small' + (acqOk ? '' : ' cant') + '" data-action="acquire" data-id="' + a.id + '"' + (acqOk ? '' : ' disabled') + '>' +
          CE.fmtMoney(E.acquireCost(S, a.id)) + '</button>') + '</div>';
    }
    html += '</div></div>';
    /* Subsidiaries */
    if (S.subsidiaries.length) {
      html += '<div class="panel"><h3>Subsidiaries</h3>' + S.subsidiaries.map(s =>
        '<div class="news-item good">' + s.name + ' — ' + CE.fmtMoney(s.rev) + '/s revenue, valued ' + CE.fmtMoney(s.val) + '</div>').join('') +
        (S.subsidiaries.length >= 2 ?
          '<button class="btn small" data-action="mergesubs">Merge subsidiaries — ' + CE.fmtMoney(E.mergeCost(S)) + ' (+10% revenue)</button>' : '') +
        '</div>';
    }
    /* LEGACY */
    const gain = E.prestigeGain(S);
    html += '<div class="panel legacy-panel"><h3>☕ LEGACY</h3>' +
      '<p>Restructure the corporation to earn permanent Legacy Points. <b>1 LP per √$1B of run revenue.</b></p>' +
      '<div class="stat-grid">' +
      '<div class="stat-card"><span class="stat-label">Legacy Points</span><b class="stat-value gold" id="lg-points">' + S.legacy.points + '</b></div>' +
      '<div class="stat-card"><span class="stat-label">Restructures</span><b class="stat-value">' + S.legacy.prestiges + '</b></div>' +
      '<div class="stat-card"><span class="stat-label">Run revenue</span><b class="stat-value" id="lg-runrev">—</b></div>' +
      '<div class="stat-card"><span class="stat-label">Points on restructure</span><b class="stat-value gold" id="lg-gain">' + gain + '</b></div></div>' +
      '<button class="btn primary' + (gain < 1 ? ' cant' : '') + '" data-action="prestige">Restructure Corporation' + (gain >= 1 ? ' (+' + gain + ' LP)' : ' (needs $1B run revenue)') + '</button>' +
      '<div class="upgrade-grid">';
    for (const u of CE.LEGACY_UPGRADES) {
      const lvl = S.legacy.upgrades[u.id] || 0;
      const maxed = lvl >= u.max;
      const cost = E.legacyCost(S, u.id);
      html += '<div class="upgrade-card repeatable"><b>' + u.name + ' <span class="lvl">Lv.' + lvl + '/' + u.max + '</span></b>' +
        '<p>' + u.desc + '</p>' +
        (maxed ? '<span class="gold">MAX</span>' :
          '<button class="btn small' + (S.legacy.points < cost ? ' cant' : '') + '" data-action="legacy" data-id="' + u.id + '">' + cost + ' LP</button>') +
        '</div>';
    }
    html += '</div></div>';
    return html;
  },
  update(S) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('cp-val', CE.fmtMoney(E.valuation(S)));
    const share = E.marketShare(S);
    set('cp-share', CE.fmtPct(share));
    set('cp-subs', String(S.subsidiaries.length));
    set('lg-runrev', CE.fmtMoney(S.stats.runRevenue));
    set('lg-gain', String(E.prestigeGain(S)));
    set('lg-points', String(S.legacy.points));
    const bar = document.getElementById('cp-sharebar');
    if (bar) {
      const colors = ['#b5484d', '#d9903f', '#8b6f9e', '#3f6f6a', '#6b7480'];
      let segs = '<div class="share-seg player" style="width:' + (share * 100).toFixed(2) + '%" title="You"></div>';
      let i = 0, total = 0;
      const alive = S.competitors.filter(c => !c.acquired);
      for (const c of S.competitors) if (!c.acquired) total += c.rev;
      const playerRev = Math.max(0, share) * (total / Math.max(1e-9, 1 - share));
      for (const c of alive) {
        const w = total > 0 ? (c.rev / (total + playerRev)) * 100 : 0;
        segs += '<div class="share-seg" style="width:' + w.toFixed(2) + '%;background:' + colors[i % colors.length] + '" title="' + c.id + '"></div>';
        i++;
      }
      bar.innerHTML = segs;
      const legend = document.getElementById('cp-sharelegend');
      if (legend) legend.innerHTML = '<span class="chip active">You ' + CE.fmtPct(share) + '</span>' +
        alive.map((c, j) => {
          const def = CE.COMPETITORS.find(x => x.id === c.id);
          const s = total > 0 ? c.rev / (total + playerRev) : 0;
          return '<span class="chip"><i style="background:' + colors[j % colors.length] + '"></i>' + def.name + ' ' + CE.fmtPct(s) + '</span>';
        }).join('');
    }
    for (const c of S.competitors) {
      set('cv-' + c.id, CE.fmtMoney(c.val));
      set('cr-' + c.id, CE.fmtMoney(c.rev) + '/s');
      const btn = document.getElementById('ca-' + c.id);
      if (btn) {
        const cost = E.competitorCost(S, c.id);
        btn.textContent = 'Acquire — ' + CE.fmtMoney(cost);
        btn.classList.toggle('cant', cost.gt(S.cash));
      }
    }
  }
};

/* ---------- Achievements ---------- */
UI.sections.achievements = {
  render(S) {
    const total = CE.ACHIEVEMENTS.length;
    const done = Object.keys(S.achievements).length;
    let html = '<div class="page-head"><h2>Achievements</h2>' +
      '<p class="muted">' + done + ' / ' + total + ' unlocked — each achievement grants +1% global revenue and Research Points.</p></div>' +
      '<div class="ach-grid">';
    for (const a of CE.ACHIEVEMENTS) {
      const got = !!S.achievements[a.id];
      const hidden = a.hidden && !got;
      const hasProg = !got && !hidden && CE.ACH_PROGRESS[a.id];
      html += '<div class="ach-card' + (got ? ' done' : '') + '">' +
        '<span class="ach-icon">' + (got ? '🏆' : hidden ? '❓' : '🔒') + '</span>' +
        '<div class="ach-body"><b>' + (hidden ? 'Hidden achievement' : a.name) + '</b>' +
        '<p>' + (hidden ? 'Keep playing to discover this.' : a.desc) + '</p>' +
        (hasProg ? '<div class="util-bar"><div class="util-fill" id="achp-' + a.id + '"></div></div>' : '') +
        (a.rp && !hidden ? '<span class="muted">Reward: +' + a.rp + ' RP</span>' : '') + '</div></div>';
    }
    return html + '</div>';
  },
  update(S) {
    if (!this._h || Date.now() - this._h > 1000) {
      this._h = Date.now();
      const H = E.snapshot(S);
      for (const id in CE.ACH_PROGRESS) {
        const el = document.getElementById('achp-' + id);
        if (el) {
          let p = 0;
          try { p = CE.ACH_PROGRESS[id](S, H); } catch (e) { p = 0; }
          el.style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%';
        }
      }
    }
  }
};
/* ---------- Statistics ---------- */
UI.sections.statistics = {
  tick: 0,
  render(S) {
    const row = (l, id) => '<div class="sum-row"><span>' + l + '</span><b id="' + id + '">—</b></div>';
    let html = '<div class="page-head"><h2>Statistics &amp; Analytics</h2></div>' +
      '<div class="two-col"><div class="panel"><h3>Lifetime</h3><div class="sum-grid">' +
      row('Total revenue', 'st-rev') + row('Total expenses', 'st-exp') +
      row('Cost of goods sold', 'st-cogs') + row('Operating expenses', 'st-opex') +
      row('Wages paid', 'st-wages') + row('Gross profit (revenue − COGS)', 'st-gross') +
      row('Net profit (lifetime)', 'st-profit') + row('Profit margin', 'st-margin') +
      row('Cups of coffee sold', 'st-cups') + row('Customers served', 'st-customers') +
      row('Cherries harvested', 'st-beans') + row('Products manufactured', 'st-products') +
      '</div></div><div class="panel"><h3>Company</h3><div class="sum-grid">' +
      row('Current net worth', 'st-worth') + row('Assets (businesses, inventory, subs)', 'st-assets') +
      row('Liabilities (payroll due, 30s)', 'st-liab') + row('Profit per second', 'st-pps') +
      row('Highest revenue/s', 'st-bestrev') + row('Highest valuation', 'st-bestworth') +
      row('Businesses owned', 'st-biz') + row('Employees', 'st-staff') +
      row('Acquisitions', 'st-acq') + row('Market share', 'st-share') +
      row('Total playtime', 'st-time') + row('Legacy Points earned', 'st-lp') +
      '</div></div></div>' +
      '<div class="chart-grid">' +
      '<div class="panel"><h3>Revenue/s</h3><canvas id="ch-rev" width="360" height="120"></canvas></div>' +
      '<div class="panel"><h3>Profit/s</h3><canvas id="ch-profit" width="360" height="120"></canvas></div>' +
      '<div class="panel"><h3>Company valuation</h3><canvas id="ch-worth" width="360" height="120"></canvas></div>' +
      '<div class="panel"><h3>Cash</h3><canvas id="ch-cash" width="360" height="120"></canvas></div>' +
      '<div class="panel"><h3>Production volume (cups + products/s)</h3><canvas id="ch-prod" width="360" height="120"></canvas></div></div>' +
      '<div class="panel"><h3>Business Performance</h3><table class="perf-table"><thead><tr>' +
      '<th>Business</th><th>Owned</th><th>Revenue/s</th><th>Opex/s</th><th>Lifetime profit</th><th>Utilization</th></tr></thead><tbody id="st-perf"></tbody></table></div>';
    return html;
  },
  update(S) {
    this.tick++;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const H = E.snapshot(S);
    set('st-rev', CE.fmtMoney(S.stats.revenue));
    set('st-exp', CE.fmtMoney(S.stats.expenses));
    set('st-cogs', CE.fmtMoney(S.stats.cogs));
    set('st-opex', CE.fmtMoney(S.stats.opex));
    set('st-wages', CE.fmtMoney(S.stats.wages));
    set('st-gross', CE.fmtMoney(S.stats.revenue.sub(S.stats.cogs)));
    set('st-profit', CE.fmtMoney(S.stats.revenue.sub(S.stats.expenses)));
    const margin = S.stats.revenue.isZero() ? 0 : S.stats.revenue.sub(S.stats.expenses).div(S.stats.revenue).toNumber();
    set('st-margin', CE.fmtPct(margin));
    set('st-assets', CE.fmtMoney(E.valuation(S).sub(S.cash)));
    set('st-liab', CE.fmtMoney(S.rates.wages.mulNum(30)));
    set('st-cups', CE.fmtQty(S.stats.cups));
    set('st-customers', CE.fmtQty(S.stats.customers));
    set('st-beans', CE.fmtQty(S.stats.beans, 'kg'));
    set('st-products', CE.fmtQty(S.stats.products));
    set('st-worth', CE.fmtMoney(H.worth));
    set('st-pps', CE.fmtMoney(S.rates.profit));
    set('st-bestrev', CE.fmtMoney(S.stats.bestRps));
    set('st-bestworth', CE.fmtMoney(S.stats.bestWorth));
    set('st-biz', String(H.totalBiz));
    set('st-staff', String(H.staff));
    set('st-acq', String(S.stats.acquisitions));
    set('st-share', CE.fmtPct(H.share));
    set('st-time', CE.fmtTime(S.stats.playtime));
    set('st-lp', String(S.legacy.lifetimeEarned));
    if (this.tick % 4 === 1) {
      const hist = S.history;
      const draw = (id, key, color) => {
        const cv = document.getElementById(id);
        if (cv) UI.lineChart(cv, hist, color, { value: p => p[key].toNumber(), zero: key === 'profit', fmt: v => CE.fmt(v) });
      };
      draw('ch-rev', 'rev', '#7a8b5c');
      draw('ch-profit', 'profit', '#e8c15a');
      draw('ch-worth', 'worth', '#d9903f');
      draw('ch-cash', 'cash', '#8b6f9e');
      const cvp = document.getElementById('ch-prod');
      if (cvp) UI.lineChart(cvp, hist, '#3f6f6a', { value: p => p.prod || 0, zero: true, fmt: v => CE.fmt(v) });
      const perf = document.getElementById('st-perf');
      if (perf) {
        perf.innerHTML = CE.BUSINESSES.filter(b => E.totalOwned(S, b.id) > 0).map(b => {
          const st = S.biz[b.id];
          return '<tr><td>' + b.name + '</td><td>' + E.totalOwned(S, b.id) + '</td><td class="pos">' +
            CE.fmtMoney(st.revRate || Big.ZERO) + '</td><td class="neg">' + CE.fmtMoney(st.opexRate || 0) +
            '</td><td>' + CE.fmtMoney(st.lifetime) + '</td><td>' + CE.fmtPct(st.util, 0) + '</td></tr>';
        }).join('');
      }
    }
  }
};
})(typeof window !== 'undefined' ? window : globalThis);
