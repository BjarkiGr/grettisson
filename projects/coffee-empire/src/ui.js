/* COFFEE EMPIRE — UI core: layout, navigation, targeted updates, toasts, modals, charts. */
(function (global) {
'use strict';
const CE = global.CE = global.CE || {};
const Big = CE.Big, E = CE.Engine;
const $ = sel => document.querySelector(sel);

const UI = CE.UI = {
  S: null, section: 'overview', updaters: [], sig: '', modalOpen: false,
  sections: {} /* name -> {render(S), update(S)?} registered by ui files */
};

UI.init = function (S) {
  UI.S = S;
  CE.fmtMode = S.settings.fmt;
  $('#logo-img').src = CE.spriteURL('logo', 48);
  /* Full section catalog. Locked sections are HIDDEN entirely (progression
     based visibility) — renderNav only shows what the player has unlocked. */
  const nav = [
    ['overview', 'Overview', 'cup'], ['brew', 'Brew', 'machine'],
    ['businesses', 'Businesses', 'shop'], ['milestones', 'Milestones', 'coin'],
    ['staff', 'Staff', 'barista'], ['production', 'Production', 'roastery'],
    ['locations', 'Locations', 'globe'], ['farms', 'Farms', 'farm'],
    ['research', 'Research', 'lab'], ['markets', 'Markets', 'financial'],
    ['corporate', 'Corporate', 'corporation'], ['achievements', 'Achievements', 'bean'],
    ['statistics', 'Statistics', 'bean']
  ];
  UI.navList = nav;
  UI.navSig = Object.keys(S.tabsUnlocked).sort().join(',');
  UI.renderNav([]);
  document.addEventListener('click', UI.onClick);
  document.addEventListener('input', UI.onInput);
  document.addEventListener('change', UI.onInput);
  UI.show(S.ui.section || 'overview');
};

/* Build sidebar + mobile bottom nav from unlocked sections only.
   `fresh` lists newly unlocked ids so they get a small entrance animation. */
UI.renderNav = function (fresh) {
  const S = UI.S;
  fresh = fresh || [];
  const unlocked = UI.navList.filter(([id]) => S.tabsUnlocked[id]);
  $('#nav').innerHTML = unlocked.map(([id, label, icon]) =>
    '<button class="nav-btn' + (fresh.indexOf(id) >= 0 ? ' nav-new' : '') + '" data-action="nav" data-id="' + id + '">' +
    CE.spriteImg(icon, 'nav-icon', 32) + '<span>' + label + '</span></button>').join('');
  /* Mobile fixed bottom navigation: Home / Brew / Businesses / 4th slot / More.
     The 4th slot shows Milestones early, Production once it unlocks. */
  const fourth = S.tabsUnlocked.production ? ['production', 'Production', 'roastery'] : ['milestones', 'Goals', 'coin'];
  const bottom = [['overview', 'Home', 'cup'], ['brew', 'Brew', 'machine'],
    ['businesses', 'Business', 'shop'], fourth, ['more', 'More', 'box']];
  UI.bottomIds = bottom.map(b => b[0]);
  $('#bottomnav').innerHTML = bottom.map(([id, label, icon]) =>
    '<button class="bnav-btn' + (fresh.indexOf(id) >= 0 ? ' nav-new' : '') + '" data-action="' + (id === 'more' ? 'more' : 'nav') + '" data-id="' + id + '">' +
    CE.spriteImg(icon, 'bnav-icon', 32) + '<span>' + label + '</span></button>').join('');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.id === UI.section));
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.toggle('active', b.dataset.id === UI.section));
};

UI.show = function (name) {
  if (!UI.sections[name] || !UI.S.tabsUnlocked[name]) name = 'overview';
  /* Keep the living scene (and its walking customers) across same-section
     refreshes — structural rebuilds must not interrupt the diorama. */
  const keep = (UI._scene && name === UI.section) ? UI._scene : null;
  if (UI._scene && !keep) { UI._scene.destroy(); UI._scene = null; }
  UI.section = name;
  UI.S.ui.section = name;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.id === name));
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.toggle('active', b.dataset.id === name));
  UI.updaters = [];
  const sec = UI.sections[name];
  $('#main').innerHTML = sec.render(UI.S);
  if (keep) {
    const holder = document.getElementById(keep.el.id);
    if (holder && holder.parentNode && holder.parentNode.replaceChild) {
      holder.parentNode.replaceChild(keep.el, holder);
      UI._scene = keep;
    } else {
      keep.destroy(); UI._scene = null;
      if (sec.mount) sec.mount(UI.S);
    }
  } else if (sec.mount) sec.mount(UI.S);
  UI.update();
  if (CE.Tutorial) CE.Tutorial.attach(UI.S);
  $('#main').scrollTop = 0;
};
UI.refresh = function () { UI.show(UI.section); };

/* Structural signature: rebuild current section only when unlocks change. */
UI.signature = function (S) {
  let unlocked = 0, ups = 0;
  for (const b of CE.BUSINESSES) if (E.bizUnlocked(S, b)) unlocked++;
  for (const u of CE.UPGRADES) if (E.upgradeAvailable(S, u)) ups++;
  return unlocked + '|' + ups + '|' + Object.keys(S.achievements).length + '|' +
    Object.keys(S.research.done).length + '|' + E.regionCount(S) + '|' +
    Object.keys(S.acquisitions).length + '|' + S.competitors.filter(c => c.acquired).length + '|' +
    (S.research.active ? S.research.active.id : '-') + '|' + S.legacy.prestiges + '|' +
    Object.keys(S.discovered).length + '|' + Object.keys(S.milestones).length + '|' +
    Object.keys(S.staffUnlocked).length + '|' + Object.keys(S.recipesUnlocked).length + '|' +
    S.researchCatsUnlocked.length + '|' + Object.keys(S.tabsUnlocked).length + '|' +
    (S.brewSession ? S.brewSession.drink + ':' + S.brewSession.step + ':' + (S.brewSession.running ? 1 : 0) : '-');
};

UI.update = function () {
  const S = UI.S;
  if (!S) return;
  /* Top bar */
  $('#tb-cash').textContent = CE.fmtMoney(S.cash);
  $('#tb-worth').textContent = CE.fmtMoney(E.valuation(S));
  $('#tb-rev').textContent = CE.fmtMoney(S.rates.rev) + '/s';
  const profit = S.rates.profit;
  const pEl = $('#tb-profit');
  pEl.textContent = CE.fmtMoney(profit) + '/s';
  pEl.className = 'tb-value ' + (profit.m < 0 ? 'neg' : 'pos');
  $('#tb-rp').textContent = CE.fmtQty(S.rp) + ' RP';
  const unread = CE.notifications.length;
  $('#bell-count').textContent = unread > 9 ? '9+' : String(unread);
  $('#bell-count').style.display = unread ? '' : 'none';
  const sec = UI.sections[UI.section];
  if (sec && sec.update) sec.update(S);
  if (CE.Tutorial) CE.Tutorial.update(S);
};

/* Periodic structural check (1 Hz from main loop). */
UI.checkStructure = function () {
  /* Newly unlocked sections appear in the navigation with a small animation. */
  const navSig = Object.keys(UI.S.tabsUnlocked).sort().join(',');
  if (navSig !== UI.navSig) {
    const prev = (UI.navSig || '').split(',');
    const fresh = Object.keys(UI.S.tabsUnlocked).filter(id => prev.indexOf(id) < 0);
    UI.navSig = navSig;
    UI.renderNav(fresh);
  }
  const sig = UI.signature(UI.S);
  if (sig !== UI.sig) { UI.sig = sig; if (!UI.modalOpen) UI.refresh(); }
};
/* ---------- Event delegation ---------- */
UI.onClick = function (ev) {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const S = UI.S, a = el.dataset.action, id = el.dataset.id;
  let refresh = false;
  switch (a) {
    case 'nav': UI.show(id); return;
    case 'more': UI.openMore(); return;
    case 'brew-select': if (E.brewSelect(S, id)) { CE.Audio.blip(440, 0.04); refresh = true; } break;
    case 'brew-step': {
      const ses = S.brewSession;
      const step = ses && CE.DRINKS[ses.drink].steps[ses.step];
      if (E.brewStartStep(S)) { CE.Audio.blip(step === 'serve' ? 880 : 520, 0.05); refresh = true; }
      else CE.Audio.blip(180, 0.08);
      break;
    }
    case 'brew-cancel': E.brewCancel(S); refresh = true; break;
    case 'bizfilter': S.ui.bizFilter = id; refresh = true; break;
    case 'brew': {
      const r = E.brew(S, id);
      if (r) { CE.Audio.blip(660, 0.05); UI.floatText(el, '+' + CE.fmtMoney(r.rev)); }
      else CE.Audio.blip(180, 0.08);
      break;
    }
    case 'buyqty': S.ui.buyQty = id === 'max' ? 'max' : parseInt(id, 10); refresh = true; break;
    case 'buybiz': {
      const n = E.buyBiz(S, id, S.ui.buyQty);
      if (n) { CE.Audio.blip(520, 0.06); UI.floatText(el, '✓ ' + n + 'x ' + CE.BIZ[id].name, 'buy'); refresh = true; } else CE.Audio.blip(180, 0.08);
      break;
    }
    case 'buyres': E.buyResource(S, id, el.dataset.qty === 'fill' ? 'fill' : parseFloat(el.dataset.qty)); break;
    case 'sellres': E.sellResource(S, id, el.dataset.qty === 'all' ? 'all' : parseFloat(el.dataset.qty)); break;
    case 'hire': E.hire(S, id, parseInt(el.dataset.n, 10)); refresh = true; break;
    case 'fire': E.fire(S, id, parseInt(el.dataset.n, 10)); refresh = true; break;
    case 'upgrade': if (E.buyUpgrade(S, id)) { CE.Audio.blip(700, 0.06); UI.floatText(el, '⬆ Upgraded!', 'buy'); refresh = true; } break;
    case 'repeatable': if (E.buyRepeatable(S, id)) { CE.Audio.blip(700, 0.06); UI.floatText(el, '⬆ Level up!', 'buy'); refresh = true; } break;
    case 'research': if (E.startResearch(S, id)) refresh = true; break;
    case 'recipe': {
      const w = parseInt(el.dataset.w, 10);
      if (E.setRecipe(S, id, el.dataset.recipe, w)) refresh = true;
      break;
    }
    case 'campaign': if (E.runCampaign(S, id)) refresh = true; break;
    case 'pausebiz': E.togglePause(S, id); refresh = true; break;
    case 'division': if (E.establishDivision(S, id)) refresh = true; break;
    case 'mergesubs': if (E.mergeSubsidiaries(S)) refresh = true; break;
    case 'unlockregion': if (E.unlockRegion(S, id)) refresh = true; break;
    case 'setregion': S.selectedRegion = id; refresh = true; break;
    case 'acquire': if (E.acquireTarget(S, id)) refresh = true; break;
    case 'acquirecomp': if (E.acquireCompetitor(S, id)) refresh = true; break;
    case 'legacy': if (E.buyLegacy(S, id)) refresh = true; break;
    case 'prestige': UI.confirmPrestige(); return;
    case 'settings': UI.openSettings(); return;
    case 'bell': UI.openNotifications(); return;
    case 'reset': UI.confirmReset(); return;
    case 'export': UI.openExport(); return;
    case 'import': UI.openImport(); return;
    case 'modal-close': UI.closeModal(); return;
    case 'modal-ok': { const fn = UI.modalOk; UI.closeModal(); if (fn) fn(); return; }
    case 'do-import': UI.doImport(); return;
    case 'copy-export': {
      const ta = $('#export-text'); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      CE.notify('Save copied to clipboard.', 'info');
      return;
    }
    case 'save-now': CE.save(S); CE.notify('Game saved.', 'good'); return;
    case 'tut-next': if (CE.Tutorial) CE.Tutorial.next(S); return;
    case 'tut-skip': if (CE.Tutorial) CE.Tutorial.skip(S); return;
    case 'tutorial-replay': UI.closeModal(); if (CE.Tutorial) CE.Tutorial.start(S); return;
  }
  if (refresh) UI.refresh();
  UI.update();
};

UI.onInput = function (ev) {
  const el = ev.target;
  const S = UI.S;
  if (el.dataset.price) {
    E.setPrice(S, el.dataset.price, parseFloat(el.value));
    const lbl = document.getElementById('price-lbl-' + el.dataset.price);
    if (lbl) lbl.textContent = Math.round(parseFloat(el.value) * 100) + '%';
  } else if (el.dataset.supply) {
    const [res, field] = el.dataset.supply.split(':');
    if (field === 'auto') E.setSupply(S, res, { auto: el.checked });
    else if (field === 'supplier') E.setSupply(S, res, { supplier: el.value });
    else E.setSupply(S, res, { [field]: Math.max(0, Math.min(1, parseFloat(el.value) || 0)) });
  } else if (el.dataset.setting) {
    const k = el.dataset.setting;
    S.settings[k] = el.type === 'checkbox' ? el.checked :
      (el.type === 'number' || el.type === 'range' ? parseInt(el.value, 10) : el.value);
    if (k === 'volume') { const lbl = document.getElementById('volume-lbl'); if (lbl) lbl.textContent = el.value + '%'; }
    if (k === 'fmt') CE.fmtMode = el.value;
    if (k === 'music') CE.Audio.setMusic(el.checked);
    if (k === 'animations') document.body.classList.toggle('no-anim', !el.checked);
    UI.update();
  }
};

/* Floating +$ text on manual brew (and purchase feedback). */
UI.floatText = function (el, text, cls) {
  if (!UI.S.settings.animations) return;
  const r = el.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'float-text' + (cls ? ' ' + cls : '');
  f.textContent = text;
  f.style.left = (r.left + r.width / 2) + 'px';
  f.style.top = r.top + 'px';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 900);
};
/* ---------- Toasts ---------- */
UI.notifSeen = 0;
UI.drainNotifications = function () {
  const list = CE.notifications;
  while (UI.notifSeen < list.length) {
    const n = list[UI.notifSeen++];
    /* During the tutorial, per-serve payment toasts are redundant noise. */
    const tutActive = UI.S && UI.S.tutorial && UI.S.tutorial.active;
    if (!(tutActive && n.msg.indexOf('Served') === 0)) UI.toast(n.msg, n.kind);
    /* Distinct audio feedback per notification type */
    if (n.msg.indexOf('Achievement') >= 0) CE.Audio.cue('achievement');
    else if (n.msg.indexOf('Research complete') >= 0) CE.Audio.cue('research');
    else if (n.msg.indexOf('Purchased') >= 0 || n.msg.indexOf('Acquired') >= 0) CE.Audio.cue('register');
    else if (n.msg.indexOf('Hired') >= 0) CE.Audio.cue('purchase');
    else if (n.msg.indexOf('Upgrade') >= 0 || n.msg.indexOf('Legacy upgrade') >= 0) CE.Audio.cue('upgrade');
    else if (n.msg.indexOf('📈') >= 0 || n.msg.indexOf('📉') >= 0) CE.Audio.cue('event');
    else if (n.msg.indexOf('restructured') >= 0) CE.Audio.cue('achievement');
  }
  if (UI.notifSeen > 200) { UI.notifSeen = list.length; }
};
UI.toast = function (msg, kind) {
  const box = $('#toasts');
  if (!box) return;
  const t = document.createElement('div');
  t.className = 'toast ' + (kind || 'info');
  t.textContent = msg;
  box.appendChild(t);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3200);
};

/* ---------- Modals ---------- */
UI.modal = function (title, body, okLabel, onOk) {
  UI.modalOpen = true;
  UI.modalOk = onOk || null;
  $('#modal-root').innerHTML =
    '<div class="modal-overlay"><div class="modal">' +
    '<div class="modal-head"><h3>' + title + '</h3>' +
    '<button class="icon-btn" data-action="modal-close">✕</button></div>' +
    '<div class="modal-body">' + body + '</div>' +
    '<div class="modal-foot">' +
    (onOk ? '<button class="btn primary" data-action="modal-ok">' + okLabel + '</button>' : '') +
    '<button class="btn" data-action="modal-close">Close</button>' +
    '</div></div></div>';
};
UI.closeModal = function () { UI.modalOpen = false; UI.modalOk = null; $('#modal-root').innerHTML = ''; };

UI.openNotifications = function () {
  const items = CE.notifications.slice().reverse().map(n =>
    '<div class="notif-item ' + n.kind + '">' + n.msg + '</div>').join('') || '<p>No notifications yet.</p>';
  UI.modal('Notifications', '<div class="notif-list">' + items + '</div>');
  UI.notifSeen = CE.notifications.length;
  UI.update();
};

UI.confirmPrestige = function () {
  const S = UI.S, gain = E.prestigeGain(S);
  if (gain < 1) {
    UI.modal('LEGACY', '<p>You need at least <b>$1.00B lifetime revenue this run</b> to restructure.</p>' +
      '<p>Current run revenue: <b>' + CE.fmtMoney(S.stats.runRevenue) + '</b></p>' +
      '<p>Legacy Points = ⌊√(run revenue / $1B)⌋. Points buy permanent upgrades that survive every reset.</p>');
    return;
  }
  UI.modal('Restructure Corporation?',
    '<p>Sell the entire corporation for <b class="gold">' + gain + ' Legacy Points</b>.</p>' +
    '<p class="warn-text">Resets: cash, businesses, employees, resources, upgrades, research, regions.</p>' +
    '<p class="pos">Keeps: achievements, lifetime statistics, Legacy Points and Legacy upgrades.</p>',
    'Restructure for ' + gain + ' LP', () => {
      const res = E.prestige(UI.S);
      if (res) {
        UI.S = CE.S = res.state;
        CE.save(UI.S);
        UI.sig = '';
        UI.refresh();
      }
    });
};

UI.confirmReset = function () {
  UI.modal('Reset EVERYTHING?',
    '<p class="warn-text">This wipes your entire save, including Legacy Points and achievements. There is no undo.</p>',
    'Yes, wipe it all', () => {
      CE.wipeSave();
      UI.S = CE.S = CE.newState();
      CE.applyLegacyStart(UI.S);
      CE.notifications.length = 0; UI.notifSeen = 0;
      E.dirty = true; UI.sig = '';
      UI.show('overview');
    });
};

UI.openExport = function () {
  UI.modal('Export Save', '<p>Copy this JSON somewhere safe:</p>' +
    '<textarea id="export-text" class="save-text" readonly>' + CE.exportSave(UI.S) + '</textarea>' +
    '<button class="btn" data-action="copy-export">Copy to clipboard</button>');
};
UI.openImport = function () {
  UI.modal('Import Save', '<p>Paste an exported save string. This replaces your current game.</p>' +
    '<textarea id="import-text" class="save-text" placeholder="Paste save here..."></textarea>' +
    '<button class="btn primary" data-action="do-import">Import</button>');
};
UI.doImport = function () {
  try {
    const S = CE.importSave($('#import-text').value);
    UI.S = CE.S = S;
    CE.fmtMode = S.settings.fmt;
    E.dirty = true; UI.sig = '';
    CE.save(S);
    UI.closeModal();
    UI.show('overview');
    CE.notify('Save imported successfully.', 'good');
  } catch (e) { CE.notify('Import failed: invalid save string.', 'warn'); }
};
/* ---------- More sheet (mobile navigation) ---------- */
UI.openMore = function () {
  const items = UI.navList.filter(([id]) => UI.S.tabsUnlocked[id] && UI.bottomIds.indexOf(id) < 0);
  UI.modal('More',
    '<div class="more-grid">' + items.map(([id, label, icon]) =>
      '<button class="more-btn" data-action="nav" data-id="' + id + '">' +
      CE.spriteImg(icon, 'more-icon', 48) + '<span>' + label + '</span></button>').join('') +
    '<button class="more-btn" data-action="settings">' + CE.spriteImg('machine', 'more-icon', 48) + '<span>Settings</span></button>' +
    '</div>');
};

/* ---------- Settings ---------- */
UI.openSettings = function () {
  const s = UI.S.settings;
  const chk = (k, label) => '<label class="setting-row"><span>' + label + '</span>' +
    '<input type="checkbox" data-setting="' + k + '"' + (s[k] ? ' checked' : '') + '></label>';
  UI.modal('Settings',
    chk('sound', 'Sound effects') +
    '<label class="setting-row"><span>Volume <b id="volume-lbl">' + (s.volume != null ? s.volume : 70) + '%</b></span>' +
    '<input type="range" min="0" max="100" step="5" value="' + (s.volume != null ? s.volume : 70) + '" data-setting="volume"></label>' +
    chk('music', 'Ambient music') +
    chk('animations', 'Animations') +
    chk('offline', 'Offline progression') +
    '<label class="setting-row"><span>Number format</span>' +
    '<select data-setting="fmt">' +
    ['short', 'sci', 'full'].map(f => '<option value="' + f + '"' + (s.fmt === f ? ' selected' : '') + '>' +
      (f === 'short' ? 'Short (1.23M)' : f === 'sci' ? 'Scientific (1.23e6)' : 'Full (1,230,000)') + '</option>').join('') +
    '</select></label>' +
    '<label class="setting-row"><span>Autosave interval (seconds)</span>' +
    '<input type="number" min="5" max="120" value="' + s.autosave + '" data-setting="autosave"></label>' +
    '<div class="setting-buttons">' +
    '<button class="btn" data-action="save-now">Save now</button>' +
    '<button class="btn" data-action="tutorial-replay">Replay tutorial</button>' +
    '<button class="btn" data-action="export">Export save</button>' +
    '<button class="btn" data-action="import">Import save</button>' +
    '<button class="btn danger" data-action="reset">Reset game</button>' +
    '</div>');
};

/* ---------- Offline summary ---------- */
UI.offlineModal = function (sum) {
  const row = (l, v, cls) => '<div class="sum-row"><span>' + l + '</span><b class="' + (cls || '') + '">' + v + '</b></div>';
  UI.modal('Welcome back, CEO!',
    '<div class="offline-hero">' + CE.spriteImg('cup', 'big-sprite', 96) +
    '<p>Your empire kept working for <b>' + CE.fmtTime(sum.seconds) + '</b>' +
    (sum.capped ? ' <span class="warn-text">(capped from ' + CE.fmtTime(sum.realSeconds) + ')</span>' : '') +
    ' at ' + CE.fmtPct(sum.eff, 0) + ' efficiency.</p></div>' +
    '<div class="sum-grid">' +
    row('Revenue', CE.fmtMoney(sum.revenue), 'pos') +
    row('Expenses', CE.fmtMoney(sum.expenses), 'neg') +
    row('Net profit', CE.fmtMoney(sum.profit), sum.profit.m < 0 ? 'neg' : 'pos') +
    row('Cups sold', CE.fmtQty(sum.cups)) +
    row('Cherries harvested', CE.fmtQty(sum.beans, 'kg')) +
    row('Products manufactured', CE.fmtQty(sum.products)) +
    row('Research completed', String(sum.researchDone)) +
    row('Events experienced', String(sum.events)) +
    '</div>');
};

/* ---------- Pixel-style canvas charts ---------- */
UI.lineChart = function (canvas, series, color, opts) {
  opts = opts || {};
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#241511';
  ctx.fillRect(0, 0, W, H);
  if (!series.length) return;
  let vals = series.map(p => (opts.value ? opts.value(p) : p));
  let min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
  if (opts.zero) min = Math.min(0, min);
  if (max - min < 1e-9) { max = min + 1; }
  /* grid */
  ctx.strokeStyle = 'rgba(232,213,181,0.12)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = Math.round(H * i / 4) + 0.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  const px = i => Math.round(i / Math.max(1, series.length - 1) * (W - 4)) + 2;
  const py = v => H - 4 - Math.round((v - min) / (max - min) * (H - 10));
  /* zero line */
  if (min < 0 && max > 0) {
    ctx.strokeStyle = 'rgba(181,72,77,0.5)';
    const y = py(0) + 0.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  vals.forEach((v, i) => { const x = px(i), y = py(v); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.stroke();
  if (opts.fill) {
    ctx.lineTo(px(vals.length - 1), H - 2); ctx.lineTo(px(0), H - 2); ctx.closePath();
    ctx.fillStyle = opts.fill; ctx.fill();
  }
  ctx.fillStyle = '#e8d5b5';
  ctx.font = '10px monospace';
  const fmt = opts.fmt || (v => CE.fmt(v));
  ctx.fillText(fmt(max), 4, 11);
  ctx.fillText(fmt(min), 4, H - 5);
};
/* ---------- Shared renderers ---------- */
UI.unlockText = function (u) {
  const parts = [];
  if (u.rev != null) parts.push(CE.fmtMoney(u.rev) + ' lifetime revenue');
  if (u.rep != null) parts.push(u.rep + ' reputation');
  if (u.regions != null) parts.push(u.regions + ' regions');
  if (u.research) parts.push('research: ' + CE.RESEARCH_MAP[u.research].name);
  if (u.biz) parts.push(u.biz[1] + 'x ' + CE.BIZ[u.biz[0]].name);
  return parts.join(', ');
};

UI.bizCard = function (S, b) {
  const owned = E.totalOwned(S, b.id);
  let cap = '';
  if (b.cups) cap = CE.fmtQty(b.cups) + ' cups/s each';
  else if (b.out) cap = Object.keys(b.out).map(r => CE.fmtQty(b.out[r]) + ' ' + CE.RESOURCES[r].unit + '/s ' + CE.RESOURCES[r].name).join(', ');
  else if (b.recipes) cap = b.recipes.length + ' production recipe' + (b.recipes.length > 1 ? 's' : '');
  else if (b.storage) cap = '+' + b.storage + 'x base storage';
  else if (b.transport) cap = CE.fmtQty(b.transport) + ' u/s transport';
  else if (b.sells) cap = b.sells.map(s => CE.fmtQty(s.rate) + '/s ' + CE.RESOURCES[s.res].name).join(', ');
  else if (b.rp) cap = b.rp + ' RP/s each';
  else if (b.effect) cap = 'Company-wide bonus';
  const next = CE.nextMilestone(owned);
  return '<div class="biz-card" id="biz-' + b.id + '">' +
    '<div class="biz-top">' + CE.spriteImg(b.sprite, 'biz-sprite', 64) +
    '<div class="biz-title"><h4>' + b.name + '</h4>' +
    '<div class="biz-owned">Owned: <b id="bo-' + b.id + '">' + owned + '</b>' +
    ' <span class="milestone" title="Ownership milestones double output">next x2 at ' + next + '</span></div>' +
    '<p class="biz-desc">' + b.desc + '</p></div></div>' +
    '<div class="biz-stats">' +
    '<span>Revenue <b class="pos" id="br-' + b.id + '">—</b></span>' +
    '<span>Opex <b class="neg" id="bx-' + b.id + '">—</b></span>' +
    '<span>Profit <b id="bp-' + b.id + '">—</b></span>' +
    '<span>Capacity <b>' + cap + '</b></span>' +
    '</div>' +
    '<div class="util-row"><div class="util-bar"><div class="util-fill" id="bu-' + b.id + '"></div></div>' +
    '<span class="util-label" id="bl-' + b.id + '"></span></div>' +
    '<div class="biz-bottom">' +
    '<button class="btn primary buy-btn" data-action="buybiz" data-id="' + b.id + '" id="bc-' + b.id + '">Buy</button>' +
    '<button class="btn small" data-action="pausebiz" data-id="' + b.id + '" id="bz-' + b.id + '" title="Pause/resume this business (paused facilities pay half rent)">⏸</button>' +
    '<span class="biz-life"><span id="ba-' + b.id + '" class="upg-avail"></span> Lifetime: <b id="bf-' + b.id + '">—</b></span>' +
    '</div></div>';
};

UI.updateBizCard = function (S, b) {
  const st = S.biz[b.id];
  const owned = E.totalOwned(S, b.id);
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('bo-' + b.id, String(owned));
  const rev = st.revRate || Big.ZERO;
  const opex = st.opexRate || 0;
  set('br-' + b.id, owned ? CE.fmtMoney(rev) + '/s' : '—');
  set('bx-' + b.id, owned ? CE.fmtMoney(opex) + '/s' : '—');
  const profit = rev.sub(Big.fromNumber(opex));
  const bp = document.getElementById('bp-' + b.id);
  if (bp) { bp.textContent = owned ? CE.fmtMoney(profit) + '/s' : '—'; bp.className = profit.m < 0 ? 'neg' : 'pos'; }
  set('bf-' + b.id, CE.fmtMoney(st.lifetime));
  const fill = document.getElementById('bu-' + b.id);
  if (fill) fill.style.width = Math.round((owned ? st.util : 0) * 100) + '%';
  set('bl-' + b.id, owned ? (st.bottleneck ? '⚠ ' + st.bottleneck : CE.fmtPct(st.util, 0) + ' utilization') : 'idle');
  const btn = document.getElementById('bc-' + b.id);
  if (btn) {
    const qty = S.ui.buyQty;
    const count = qty === 'max' ? Math.max(1, CE.maxAffordable(b.cost, b.g, owned, S.cash)) : qty;
    const cost = CE.costFor(b.cost, b.g, owned, count);
    btn.textContent = 'Buy x' + count + ' — ' + CE.fmtMoney(cost);
    btn.classList.toggle('cant', cost.gt(S.cash));
  }
  const pz = document.getElementById('bz-' + b.id);
  if (pz) { pz.textContent = st.paused ? '▶' : '⏸'; pz.classList.toggle('primary', !!st.paused); }
  const ba = document.getElementById('ba-' + b.id);
  if (ba) {
    let avail = 0;
    for (let t = 0; t < 5; t++) {
      const u = CE.UPGRADE_MAP[b.id + '_t' + t];
      if (u && E.upgradeAvailable(S, u)) avail++;
    }
    ba.textContent = avail ? '⬆ ' + avail + ' upgrade' + (avail > 1 ? 's' : '') + ' ·' : '';
  }
};
/* ---------- Businesses section ---------- */
UI.sections.businesses = {
  render(S) {
    E.ensureMods(S);
    const qtyBtn = q => '<button class="chip' + (String(S.ui.buyQty) === String(q) ? ' active' : '') +
      '" data-action="buyqty" data-id="' + q + '">' + (q === 'max' ? 'MAX' : 'x' + q) + '</button>';
    let html = '<div class="page-head"><h2>Businesses</h2>' +
      '<div class="chip-row">Buy: ' + [1, 10, 100, 'max'].map(qtyBtn).join('') + '</div>' +
      '<div class="chip-row">Region: ' + CE.REGION_ORDER.filter(r => S.regions[r] && S.regions[r].unlocked).map(r =>
        '<button class="chip' + (S.selectedRegion === r ? ' active' : '') + '" data-action="setregion" data-id="' + r + '">' +
        CE.REGIONS[r].name + '</button>').join('') + '</div></div>';
    const availAll = CE.UPGRADES.filter(u => E.upgradeAvailable(S, u));
    const avail = availAll.slice().sort((a, b) => a.cost - b.cost).slice(0, 12);
    html += '<div class="panel"><h3>Upgrades <span class="muted">(' + availAll.length + ' available, ' +
      (Object.keys(S.upgrades).length + Object.values(S.repeatables).reduce((a, b) => a + b, 0)) + ' purchased)</span></h3><div class="upgrade-grid">';
    for (const u of avail) {
      html += '<div class="upgrade-card"><b>' + u.name + '</b><p>' + u.desc + '</p>' +
        '<button class="btn small' + (Big.fromNumber(u.cost).gt(S.cash) ? ' cant' : '') + '" data-action="upgrade" data-id="' + u.id + '">' +
        CE.fmtMoney(u.cost) + '</button></div>';
    }
    for (const u of CE.REPEATABLES) {
      const lvl = S.repeatables[u.id] || 0;
      const cost = E.repeatableCost(S, u.id);
      html += '<div class="upgrade-card repeatable"><b>' + u.name + ' <span class="lvl">Lv.' + lvl + '</span></b><p>' + u.desc + '</p>' +
        '<button class="btn small' + (cost.gt(S.cash) ? ' cant' : '') + '" data-action="repeatable" data-id="' + u.id + '">' +
        CE.fmtMoney(cost) + '</button></div>';
    }
    html += '</div></div>';
    /* Discovery system: HIDDEN businesses are never shown. Discovered ones
       stay visible (AVAILABLE or OWNED) even when unaffordable. */
    const filter = S.ui.bizFilter || 'all';
    html += '<div class="chip-row">Show: ' + [['all', 'All discovered'], ['owned', 'Portfolio (owned)'], ['available', 'Not yet owned']].map(([id, label]) =>
      '<button class="chip' + (filter === id ? ' active' : '') + '" data-action="bizfilter" data-id="' + id + '">' + label + '</button>').join('') +
      '<span class="muted">' + Object.keys(S.discovered).length + ' / ' + CE.BUSINESSES.length + ' discovered</span></div>';
    let shown = 0;
    for (const cat of CE.BIZ_CATS) {
      let list = CE.BUSINESSES.filter(b => b.cat === cat.id && S.discovered[b.id]);
      if (filter === 'owned') list = list.filter(b => E.totalOwned(S, b.id) > 0);
      if (filter === 'available') list = list.filter(b => E.totalOwned(S, b.id) === 0);
      if (!list.length) continue;
      shown += list.length;
      html += '<h3 class="cat-head">' + CE.spriteImg(cat.icon, 'cat-icon', 32) + cat.name + '</h3><div class="biz-grid">';
      for (const b of list) html += UI.bizCard(S, b);
      html += '</div>';
    }
    if (!shown) html += '<div class="panel"><p class="muted">No businesses here yet. Keep growing — new businesses are discovered through milestones and revenue.</p></div>';
    return html;
  },
  update(S) {
    for (const b of CE.BUSINESSES) if (document.getElementById('biz-' + b.id)) UI.updateBizCard(S, b);
  }
};

/* ---------- Staff section ---------- */
UI.sections.staff = {
  render(S) {
    E.ensureMods(S);
    let html = '<div class="page-head"><h2>Employees</h2><p class="muted">Staff run your businesses — unstaffed businesses stay closed until you hire or research automation. Managers unlock full automation. Employees gain experience over time. Staff are only paid while their workplaces run — when everything is idle they are sent home (no wages).</p></div><div class="biz-grid">';
    const unlockedTypes = Object.keys(CE.STAFF).filter(t => S.staffUnlocked[t]);
    if (!unlockedTypes.length) {
      html += '<div class="panel"><p class="muted">No employee types unlocked yet. Reach <b>$250 lifetime revenue</b> (milestone "First Barista") to hire your first barista — then your cart will run automatically.</p></div>';
    }
    for (const t of unlockedTypes) {
      const def = CE.STAFF[t], st = S.staff[t];
      html += '<div class="biz-card"><div class="biz-top">' + CE.spriteImg(def.sprite, 'biz-sprite', 64) +
        '<div class="biz-title"><h4>' + def.name + '</h4>' +
        '<div class="biz-owned">Employed: <b id="sn-' + t + '">' + st.n + '</b> / needed <b id="sd-' + t + '">0</b></div>' +
        '<p class="biz-desc">' + def.desc + '</p></div></div>' +
        '<div class="biz-stats">' +
        '<span>Salary <b>' + CE.fmtMoney(def.salary) + '/s each</b></span>' +
        '<span>Payroll <b class="neg" id="sp-' + t + '">—</b></span>' +
        '<span>Efficiency <b id="se-' + t + '">—</b></span>' +
        '<span>Skill <b id="sx-' + t + '">—</b></span></div>' +
        '<div class="util-row"><div class="util-bar"><div class="util-fill" id="su-' + t + '"></div></div>' +
        '<span class="util-label" id="sr-' + t + '"></span></div>' +
        '<div class="biz-bottom staff-btns">' +
        '<button class="btn primary small" data-action="hire" data-id="' + t + '" data-n="1" id="sh1-' + t + '">Hire 1</button>' +
        '<button class="btn small" data-action="hire" data-id="' + t + '" data-n="10" id="sh10-' + t + '">+10</button>' +
        '<button class="btn small" data-action="hire" data-id="' + t + '" data-n="100" id="sh100-' + t + '">+100</button>' +
        '<button class="btn small danger" data-action="fire" data-id="' + t + '" data-n="1">Fire 1</button>' +
        '</div></div>';
    }
    return html + '</div>';
  },
  update(S) {
    E.ensureMods(S);
    for (const t in CE.STAFF) {
      if (!S.staffUnlocked[t]) continue;
      const st = S.staff[t], eff = E.eff[t], need = E.needs[t];
      const idle = !!(E.idleTypes && E.idleTypes[t]);
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('sn-' + t, String(st.n));
      set('sd-' + t, CE.fmtQty(need));
      set('sp-' + t, idle ? '$0/s (idle)' : CE.fmtMoney(st.n * CE.STAFF[t].salary * E.mods.wageMult) + '/s');
      set('se-' + t, CE.fmtPct(eff.mult, 0));
      set('sx-' + t, 'Lv.' + Math.floor(st.xp * 100));
      const fill = document.getElementById('su-' + t);
      if (fill) fill.style.width = Math.round(eff.ratio * 100) + '%';
      set('sr-' + t, idle ? 'idle — sent home' : need > 0 ? CE.fmtPct(eff.ratio, 0) + ' staffed' : 'no demand');
      for (const n of [1, 10, 100]) {
        const btn = document.getElementById('sh' + n + '-' + t);
        if (btn) {
          const cost = E.hireCost(S, t, n);
          btn.textContent = (n === 1 ? 'Hire — ' : '+' + n + ' — ') + CE.fmtMoney(cost);
          btn.classList.toggle('cant', cost.gt(S.cash));
        }
      }
    }
  }
};
/* ---------- Overview / dashboard ---------- */
UI.sections.overview = {
  render(S) {
    E.ensureMods(S);
    const stat = (id, label) => '<div class="stat-card"><span class="stat-label">' + label + '</span><b class="stat-value" id="' + id + '">—</b></div>';
    let html = '<div class="page-head"><h2>Company Overview</h2>' +
      '<div class="brand-row"><span>Brand reputation</span><div class="util-bar brand-bar"><div class="util-fill" id="ov-brand"></div></div><b id="ov-brand-n"></b></div></div>' +
      '<div class="stat-grid">' +
      stat('ov-cash', 'Cash') + stat('ov-worth', 'Net worth') + stat('ov-rev', 'Revenue/s') +
      stat('ov-exp', 'Expenses/s') + stat('ov-profit', 'Profit/s') + stat('ov-biz', 'Businesses') +
      stat('ov-staff', 'Employees') + stat('ov-share', 'Market share') + '</div>';
    /* Brew station shortcut */
    html += '<div class="panel brew-panel"><h3>' + CE.spriteImg('cup', 'cat-icon', 32) + ' Brew Station</h3>' +
      '<div class="scene" id="ov-scene" aria-hidden="true"></div>' +
      '<button class="btn primary" data-action="nav" data-id="brew">☕ Open Brew Station (' + CE.fmtQty(E.mods.manualMult) + ' cups per brew)</button>' +
      '<p class="muted" id="brew-stock"></p></div>';
    /* Objectives */
    html += '<div class="panel"><h3>Current Objectives</h3><div id="ov-objectives"></div></div>';
    /* Events */
    html += '<div class="two-col"><div class="panel"><h3>Active Events</h3><div id="ov-events"></div></div>' +
      '<div class="panel"><h3>Recent News</h3><div id="ov-news"></div></div></div>';
    return html;
  },
  mount(S) {
    if (CE.Scene) UI._scene = CE.Scene.mount(document.getElementById('ov-scene'), S);
  },
  update(S) {
    if (UI._scene) UI._scene.update(S);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('ov-cash', CE.fmtMoney(S.cash));
    set('ov-worth', CE.fmtMoney(E.valuation(S)));
    set('ov-rev', CE.fmtMoney(S.rates.rev));
    set('ov-exp', CE.fmtMoney(S.rates.exp));
    const p = document.getElementById('ov-profit');
    if (p) { p.textContent = CE.fmtMoney(S.rates.profit); p.className = 'stat-value ' + (S.rates.profit.m < 0 ? 'neg' : 'pos'); }
    const H = E.snapshot(S);
    set('ov-biz', String(H.totalBiz));
    set('ov-staff', String(H.staff));
    set('ov-share', CE.fmtPct(H.share));
    const bf = document.getElementById('ov-brand');
    if (bf) bf.style.width = S.brand + '%';
    set('ov-brand-n', Math.round(S.brand) + ' / 100 — ' + E.brandTier(S));
    set('brew-stock', 'Stock: ' + CE.fmtQty(S.resources.roasted, 'kg') + ' roasted beans · ' +
      CE.fmtQty(S.resources.milk, 'L') + ' milk · ' + CE.fmtQty(S.resources.water, 'L') + ' water · ' +
      CE.fmtQty(S.resources.specialty, 'kg') + ' specialty');
    const obj = document.getElementById('ov-objectives');
    if (obj) {
      obj.innerHTML = E.objectives(S).map(o =>
        '<div class="objective"><div><b>' + o.text + '</b>' + (o.detail ? '<span class="muted"> — ' + o.detail + '</span>' : '') + '</div>' +
        (o.progress != null ? '<div class="util-bar"><div class="util-fill" style="width:' + Math.round(o.progress * 100) + '%"></div></div>' : '') +
        '</div>').join('') || '<p class="muted">All caught up. Build your empire!</p>';
    }
    const ev = document.getElementById('ov-events');
    if (ev) {
      ev.innerHTML = S.events.active.map(a => {
        const def = CE.EVENT_MAP[a.id];
        return '<div class="event-chip ' + (def.good ? 'good' : 'bad') + '"><b>' + def.name + '</b><span>' +
          CE.fmtTime(a.ends - S.time) + ' left</span><p>' + def.desc + '</p></div>';
      }).join('') + S.campaigns.map(c => {
        const def = CE.CAMPAIGNS.find(x => x.id === c.id);
        return '<div class="event-chip good"><b>📣 ' + def.name + '</b><span>' + CE.fmtTime(c.ends - S.time) + ' left</span></div>';
      }).join('') || '<p class="muted">Markets are calm.</p>';
    }
    const news = document.getElementById('ov-news');
    if (news) {
      news.innerHTML = CE.notifications.slice(-6).reverse().map(n =>
        '<div class="news-item ' + n.kind + '">' + n.msg + '</div>').join('') || '<p class="muted">No news yet.</p>';
    }
  }
};
})(typeof window !== 'undefined' ? window : globalThis);
