/* COFFEE EMPIRE — UI sections: interactive Brew screen and Milestones. */
(function (global) {
'use strict';
const CE = global.CE = global.CE || {};
const Big = CE.Big, E = CE.Engine, UI = CE.UI;

/* ---------- Brew (manual, step-by-step) ---------- */
UI.sections.brew = {
  render(S) {
    E.ensureMods(S);
    const ses = S.brewSession;
    const drink = ses ? CE.DRINKS[ses.drink] : null;
    let html = '<div class="page-head"><h2>Brew Coffee</h2>' +
      '<p class="muted">Make coffee by hand: pick a drink, work through each step, serve the customer, get paid. ' +
      'Each brew makes <b>' + CE.fmtQty(E.mods.manualMult) + '</b> cup(s).</p></div>';
    /* Living diorama of the cart — barista, customers, steam. */
    html += '<div class="scene" id="brew-scene" aria-hidden="true"></div>';
    /* Drink selector */
    html += '<div class="panel"><h3>Choose a Drink</h3><div class="brew-grid">';
    for (const d in CE.DRINKS) {
      if (!E.drinkAvailable(S, d)) continue;
      const def = CE.DRINKS[d];
      html += '<button class="brew-btn' + (ses && ses.drink === d ? ' selected' : '') + '" data-action="brew-select" data-id="' + d + '">' +
        '<b>' + def.name + '</b><span>' + CE.fmtMoney(def.price * (S.prices[d] || 1)) + '</span></button>';
    }
    html += '</div><p class="muted">New recipes are unlocked through milestones.</p></div>';
    if (!ses) {
      html += '<div class="panel"><p class="muted">Select a drink above to start brewing.</p>' +
        (S.staff.barista.n === 0 ?
          '<p class="muted">💡 Reach $250 lifetime revenue, then hire your first barista (Staff page) — your cart will brew automatically while you manage the business.</p>' :
          '<p class="pos">✓ Your barista is running the cart automatically. Manual brewing still earns extra cash.</p>') +
        '</div>';
      return html;
    }
    /* Step pipeline */
    const payment = CE.fmtMoney(ses.cups * drink.price * (S.prices[ses.drink] || 1) * E.mods.retailRevMult * E.mods.revenueMult);
    html += '<div class="panel brew-session"><h3>' + drink.name + ' <span class="muted">— ' + CE.fmtQty(ses.cups) + ' cup(s)</span></h3><div class="brew-steps">';
    drink.steps.forEach((step, i) => {
      const def = CE.BREW_STEPS[step];
      const dur = E.stepDuration(S, step);
      let cls = 'pending', right = '';
      if (i < ses.step) { cls = 'done'; right = '<span class="pos">✓</span>'; }
      else if (i === ses.step) {
        cls = 'current';
        if (ses.running) {
          const remain = Math.max(0.05, ses.dur - ses.t);
          right = '<div class="util-bar brew-progress"><div class="util-fill brew-run" id="brew-progress" style="animation-duration:' + remain.toFixed(2) + 's;animation-delay:-' + ses.t.toFixed(2) + 's"></div></div>';
        } else {
          const label = step === 'serve' ? 'Serve — ' + payment : def.name + (dur > 0 ? ' (' + dur.toFixed(1) + 's)' : ' (instant)');
          right = '<button class="btn primary brew-action" data-action="brew-step">' + label + '</button>';
        }
      }
      html += '<div class="brew-step ' + cls + '"><span class="brew-step-n">' + (i + 1) + '</span>' +
        '<span class="brew-step-name">' + def.name + '</span>' + right + '</div>';
    });
    html += '</div>';
    /* Current step ingredient needs */
    const curStep = drink.steps[ses.step];
    if (curStep && !ses.running) {
      const need = E.brewStepIngredients(S, ses.drink, curStep, ses.cups);
      const keys = Object.keys(need);
      if (keys.length) {
        html += '<div class="brew-needs">Needs: ' + keys.map(r => {
          const ok = S.resources[r] >= need[r] - 1e-12;
          return '<span class="' + (ok ? 'pos' : 'neg') + '">' + CE.fmtQty(need[r], CE.RESOURCES[r].unit) + ' ' + CE.RESOURCES[r].name + '</span>';
        }).join(' · ') + '</div>';
      }
    }
    if (ses.running) html += '<p class="muted" id="brew-verb">' + CE.BREW_STEPS[curStep].verb + '</p>';
    html += '<div class="chip-row"><button class="btn small danger" data-action="brew-cancel">Cancel brew</button>' +
      '<span class="muted">Ingredients already used are not refunded.</span></div></div>';
    /* Stock */
    html += '<div class="panel"><h3>Ingredient Stock</h3><div class="chip-row" id="brew-stock"></div>' +
      '<div class="chip-row">' + [['roasted', 1], ['milk', 5], ['water', 20]].map(([r, q]) =>
        '<button class="btn small" data-action="buyres" data-id="' + r + '" data-qty="' + q + '">Buy ' +
        q + ' ' + CE.RESOURCES[r].unit + ' ' + CE.RESOURCES[r].name + ' (' + CE.fmtMoney(E.buyPrice(S, r) * q) + ')</button>').join('') + '</div></div>';
    return html;
  },
  mount(S) {
    if (CE.Scene) UI._scene = CE.Scene.mount(document.getElementById('brew-scene'), S);
  },
  update(S) {
    const ses = S.brewSession;
    /* React to step completion immediately (the 1 Hz structural check made
       the next button feel frozen, especially on mobile). */
    const sig = ses ? ses.drink + ':' + ses.step + ':' + (ses.running ? 1 : 0) : '-';
    if (this._sesSig != null && sig !== this._sesSig) { this._sesSig = sig; UI.refresh(); return; }
    this._sesSig = sig;
    if (UI._scene) UI._scene.update(S);
    if (ses && ses.running && !S.settings.animations) {
      /* Animations off: drive the bar manually instead of the CSS animation. */
      const fill = document.getElementById('brew-progress');
      if (fill) fill.style.transform = 'scaleX(' + Math.min(1, ses.t / ses.dur) + ')';
    }
    const stock = document.getElementById('brew-stock');
    if (stock) {
      stock.innerHTML = ['roasted', 'specialty', 'ground', 'milk', 'water', 'sugar', 'cocoa'].map(r =>
        '<span class="chip">' + CE.RESOURCES[r].name + ': <b>' + CE.fmtQty(S.resources[r]) + '</b></span>').join('');
    }
  }
};
/* ---------- Milestones ---------- */
UI.rewardText = function (r) {
  const parts = [];
  (r.recipes || []).forEach(id => parts.push('🥤 ' + CE.DRINKS[id].name + ' recipe'));
  (r.staff || []).forEach(id => parts.push('👤 ' + CE.STAFF[id].name + ' hiring'));
  (r.discover || []).forEach(id => parts.push('🔎 ' + CE.BIZ[id].name));
  (r.cats || []).forEach(c => parts.push('🔬 ' + c + ' research'));
  (r.features || []).forEach(f => parts.push('⭐ ' + (f === 'campaigns' ? 'Marketing campaigns' : f)));
  if (r.rp) parts.push('+' + r.rp + ' RP');
  if (r.cash) parts.push('+' + CE.fmtMoney(r.cash));
  return parts;
};
UI.sections.milestones = {
  render(S) {
    const done = Object.keys(S.milestones).length;
    let html = '<div class="page-head"><h2>Milestones</h2>' +
      '<p class="muted">' + done + ' / ' + CE.MILESTONES.length + ' completed. Milestones unlock recipes, employees, businesses, research and features. They persist through saves and restructures.</p></div>';
    for (const group of CE.MILESTONE_GROUPS) {
      const list = CE.MILESTONES.filter(m => m.group === group);
      html += '<h3 class="cat-head">' + group + '</h3><div class="ms-grid">';
      for (const m of list) {
        const got = !!S.milestones[m.id];
        let v = 0;
        try { v = m.metric(S, E.snapshot(S)); } catch (e) { v = 0; }
        const pct = Math.min(1, v / m.target);
        html += '<div class="ms-card' + (got ? ' done' : '') + '">' +
          '<div class="ms-head"><b>' + (got ? '🏁 ' : '') + m.name + '</b>' +
          '<span class="ms-req" id="msq-' + m.id + '">' + CE.fmtQty(Math.min(v, m.target)) + ' / ' + CE.fmtQty(m.target) + '</span></div>' +
          '<p class="ms-desc">' + m.desc + '</p>' +
          '<div class="util-bar"><div class="util-fill" id="msp-' + m.id + '" style="width:' + Math.round(pct * 100) + '%"></div></div>' +
          '<div class="ms-rewards">' + UI.rewardText(m.rewards || {}).map(x => '<span class="chip tiny-chip">' + x + '</span>').join('') + '</div>' +
          '</div>';
      }
      html += '</div>';
    }
    return html;
  },
  update(S) {
    if (this._t && Date.now() - this._t < 1000) return;
    this._t = Date.now();
    const H = E.snapshot(S);
    for (const m of CE.MILESTONES) {
      if (S.milestones[m.id]) continue;
      let v = 0;
      try { v = m.metric(S, H); } catch (e) { v = 0; }
      const fill = document.getElementById('msp-' + m.id);
      if (fill) fill.style.width = Math.round(Math.min(1, v / m.target) * 100) + '%';
      const q = document.getElementById('msq-' + m.id);
      if (q) q.textContent = CE.fmtQty(Math.min(v, m.target)) + ' / ' + CE.fmtQty(m.target);
    }
  }
};
})(typeof window !== 'undefined' ? window : globalThis);
