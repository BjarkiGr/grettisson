// Orchestrates everything: bank loading, the start screen, daily/unlimited
// runs, the guess -> reveal -> results flow, the growing lengja, sharing.
const Game = {
  mode: 'daily', items: [], idx: 0, guesses: [], phase: 'loading',
  number: 1, thursday: false, sfx: new Sfx(), lastResult: null,
  guessValue: 250, el: {}, bannerTimer: null,

  async boot() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      puzzle: $('puzzle-label'), cm: $('cm-count'),
      start: $('start-phase'), startBtn: $('start-btn'),
      loading: $('loading'), loadError: $('load-error'),
      guess: $('guess-phase'), reveal: $('reveal-phase'), results: $('results-phase'),
      progress: $('progress'), img: $('product-img'), name: $('product-name'),
      size: $('product-size'), cat: $('product-cat'),
      slider: $('guess-slider'), readout: $('guess-readout'), ticks: $('slider-ticks'),
      input: $('guess-input'), streak: $('streak-line'), rStreak: $('results-streak'),
      stats: $('stats-modal'), statsBody: $('stats-body'),
      guessError: $('guess-error'), bake: $('bake-btn'),
      tierEmoji: $('tier-emoji'), tierName: $('tier-name'), tierCm: $('tier-cm'),
      rGuess: $('reveal-guess'), rPrice: $('reveal-price'), rError: $('reveal-error'),
      history: $('price-history'),
      link: $('product-link'), next: $('next-btn'),
      rTitle: $('results-title'), rCm: $('results-cm'), rRank: $('results-rank'),
      receipt: $('results-receipt'), rNote: $('results-note'),
      share: $('share-btn'), unlimited: $('unlimited-btn'), backDaily: $('back-daily-btn'),
      lbBtn: $('leaderboard-btn'), lb: $('lb-modal'), lbName: $('lb-name'),
      lbPin: $('lb-pin'), lbMsg: $('lb-msg'),
      tomorrow: $('tomorrow-note'), banner: $('milestone-banner'),
      howto: $('howto'), snapshot: $('snapshot-date'), mute: $('mute-btn'),
    };
    this.el.img.onerror = () => {
      this.el.img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><text x="80" y="105" font-size="90" text-anchor="middle">🥐</text></svg>');
      this.el.img.onerror = null;
    };
    Lengja.init($('lengja-scroller'), $('strip'), $('ruler'));
    this.buildTicks();
    this.bind();
    try { await loadBank(Daily.today()); } catch (e) {
      this.el.loading.hidden = true; this.el.loadError.hidden = false; return;
    }
    this.el.snapshot.textContent = Bank.snapshotDate;
    fitSliderToBank(Bank.products);
    this.buildTicks();
    await loadHistory();
    this.el.loading.hidden = true;
    this.showStart();
  },

  bind() {
    this.el.startBtn.addEventListener('click', () => this.start());
    this.el.bake.addEventListener('click', () => this.bake());
    this.el.slider.addEventListener('input', () => {
      this.guessValue = sliderToPrice(parseInt(this.el.slider.value, 10));
      this.el.readout.textContent = formatKr(this.guessValue);
      this.el.input.value = String(this.guessValue);
      this.el.slider.setAttribute('aria-valuetext', formatKr(this.guessValue));
    });
    this.el.slider.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.bake(); });
    document.querySelectorAll('.tune-btn').forEach((b) => {
      b.addEventListener('click', () => this.setGuess(this.guessValue + parseInt(b.dataset.d, 10)));
    });
    // Type-in price: parses "1.499", "1499 kr." etc. via parseKr(). Valid
    // input moves the slider live; junk keeps the last valid guess and is
    // flagged on blur. Enter bakes, just like on the slider.
    this.el.input.addEventListener('input', () => {
      const v = parseKr(this.el.input.value);
      if (Number.isFinite(v) && v > 0) {
        this.guessValue = clamp(Math.round(v), SLIDER_MIN, SLIDER_MAX);
        this.el.slider.value = priceToSlider(this.guessValue);
        this.el.readout.textContent = formatKr(this.guessValue);
        this.el.slider.setAttribute('aria-valuetext', formatKr(this.guessValue));
        this.el.guessError.hidden = true;
      }
    });
    this.el.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.bake(); });
    this.el.input.addEventListener('blur', () => {
      const raw = String(this.el.input.value).trim();
      if (raw && !Number.isFinite(parseKr(raw))) {
        this.el.guessError.textContent = 'Sláðu inn tölu, t.d. 1.499';
        this.el.guessError.hidden = false;
      } else {
        this.el.input.value = String(this.guessValue);
      }
    });
    this.el.lbBtn.addEventListener('click', () => this.openLeaderboard());
    document.getElementById('lb-submit').addEventListener('click', () => this.submitToLeaderboard());
    document.getElementById('lb-close').addEventListener('click', () => { this.el.lb.hidden = true; });
    this.el.lbPin.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.submitToLeaderboard(); });
    document.getElementById('stats-btn').addEventListener('click', () => this.openStats());
    document.getElementById('stats-close').addEventListener('click', () => { this.el.stats.hidden = true; });
    this.el.next.addEventListener('click', () => this.next());
    this.el.share.addEventListener('click', () => this.share());
    this.el.unlimited.addEventListener('click', () => { this.sfx.unlock(); this.startUnlimited(); });
    this.el.backDaily.addEventListener('click', () => this.showSaved());
    document.getElementById('retry-btn').addEventListener('click', () => location.reload());
    document.getElementById('help-btn').addEventListener('click', () => this.openHowto());
    document.getElementById('howto-close').addEventListener('click', () => this.closeHowto());
    this.el.mute.addEventListener('click', () => {
      this.sfx.unlock();
      const m = this.sfx.toggleMute();
      this.el.mute.textContent = m ? '🔇' : '🔊';
      try { localStorage.setItem('verdlengjan-muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
    });
    try {
      if (localStorage.getItem('verdlengjan-muted') === '1') {
        this.sfx.muted = true; this.el.mute.textContent = '🔇';
      }
    } catch (e) { /* ignore */ }
  },

  // The start screen: "Búa til vínarbrauð dagsins!" (or view today's if played).
  showStart() {
    this.phase = 'start';
    this.el.start.hidden = false;
    this.number = Daily.number();
    this.el.puzzle.textContent = '#' + this.number + ' · dagleg karfa';
    this.el.startBtn.textContent = Daily.playedToday()
      ? 'Sjá vínarbrauð dagsins 🥐'
      : 'Búa til vínarbrauð dagsins! 🥐';
    const s = this.streakLine();
    this.el.streak.textContent = s;
    this.el.streak.hidden = !s;
  },

  // Streak badge: just "🔥 N" - no words to get grammatically wrong. Only
  // shown while the streak is alive (played today or yesterday).
  streakLine() {
    const d = Daily.load();
    if (!d.streak || !d.lastPlayed) return '';
    const today = Daily.today();
    const yesterday = new Date(Date.parse(today + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
    if (d.lastPlayed !== today && d.lastPlayed !== yesterday) return '';
    return '🔥 ' + d.streak;
  },

  start() {
    this.sfx.unlock();
    this.el.start.hidden = true;
    let seen = false;
    try { seen = !!localStorage.getItem('verdlengjan-seen-howto'); } catch (e) { /* ignore */ }
    if (!seen) this.openHowto();
    if (Daily.playedToday()) this.showSaved(); else this.startDaily();
  },

  openHowto() { this.el.howto.hidden = false; },
  closeHowto() {
    this.el.howto.hidden = true;
    try { localStorage.setItem('verdlengjan-seen-howto', '1'); } catch (e) { /* ignore */ }
  },

  // Set the guess programmatically (fine-tune buttons, per-item reset):
  // clamp to the slider range, reposition the thumb, update the readout.
  setGuess(p) {
    this.guessValue = clamp(Math.round(p), SLIDER_MIN, SLIDER_MAX);
    this.el.slider.value = priceToSlider(this.guessValue);
    this.el.readout.textContent = formatKr(this.guessValue);
    this.el.input.value = String(this.guessValue);
    this.el.slider.setAttribute('aria-valuetext', formatKr(this.guessValue));
  },

  buildTicks() {
    const prices = [10, 50, 100, 250, 500, 1000, 2500, 5000, 15000];
    if (SLIDER_MAX > 15000) prices.push(SLIDER_MAX);
    this.el.ticks.innerHTML = '';
    for (const p of prices) {
      const t = document.createElement('span');
      t.style.left = (priceToSlider(p) / SLIDER_STEPS * 100) + '%';
      t.textContent = formatKr(p).replace(' kr.', '');
      this.el.ticks.appendChild(t);
    }
  },

  startDaily() {
    this.mode = 'daily';
    this.number = Daily.number();
    this.thursday = isThursday(Daily.today());
    this.items = buildDailyFive(Bank.products, Daily.today(), this.number);
    this.el.puzzle.textContent = '#' + this.number + ' · dagleg karfa';
    this.startRun();
  },

  startUnlimited() {
    this.mode = 'unlimited';
    this.thursday = false;
    this.items = randomFive(Bank.products);
    this.el.puzzle.textContent = 'ótakmarkað bakkelsi ∞';
    this.startRun();
  },

  startRun() {
    this.idx = 0; this.guesses = [];
    Lengja.reset();
    this.updateCm();
    this.showGuess();
  },

  showGuess() {
    this.phase = 'guess';
    this.el.start.hidden = true;
    this.el.guess.hidden = false; this.el.reveal.hidden = true; this.el.results.hidden = true;
    const p = this.items[this.idx];
    this.el.progress.textContent = 'Vara ' + (this.idx + 1) + ' af ' + this.items.length;
    this.el.img.style.display = '';
    this.el.img.src = p.image;
    this.el.img.alt = p.name;
    this.el.name.textContent = p.name;
    this.el.size.textContent = p.size || '';
    this.el.cat.textContent = p.category ? (p.size ? ' · ' : '') + p.category : '';
    this.setGuess(250);
    this.el.guessError.hidden = true;
    this.el.slider.focus({ preventScroll: true });
    if (this.items[this.idx + 1]) { const im = new Image(); im.src = this.items[this.idx + 1].image; }
  },

  bake() {
    if (this.phase !== 'guess') return;
    this.sfx.unlock();
    const v = this.guessValue;
    if (!Number.isFinite(v) || v <= 0) return; // slider always yields a valid price
    const p = this.items[this.idx];
    const s = scoreGuess(v, p.price);
    const g = { sku: p.sku, name: p.name, guess: v, price: p.price, tierId: s.tierId, cm: s.cm, error: s.error };
    this.guesses.push(g);
    const prev = Lengja.totalCm;
    Lengja.addSlice(s.cm, s.tierId, true);
    this.updateCm();
    this.checkMilestones(prev, Lengja.totalCm);
    if (s.tierId === 'exact') this.sfx.fanfare();
    else if (s.tierId === 'miss') this.sfx.sad();
    else { this.sfx.ding(); this.sfx.puff(); }
    this.showReveal(g, p);
  },

  showReveal(g, p) {
    this.phase = 'reveal';
    this.el.guess.hidden = true; this.el.reveal.hidden = false;
    const t = tierById(g.tierId);
    this.el.tierEmoji.textContent = t.emoji;
    this.el.tierName.textContent = t.name;
    this.el.tierCm.textContent = '+' + g.cm + ' cm';
    this.el.rGuess.textContent = formatKr(g.guess);
    this.el.rPrice.textContent = formatKr(g.price);
    this.el.rError.textContent = g.guess === g.price ? '0% — nákvæmt!' : Math.round(g.error * 100) + '%';
    this.el.link.href = p.url;
    this.showHistory(p);
    this.el.next.textContent = this.idx === this.items.length - 1 ? 'Sjá lengjuna →' : 'Næsta vara →';
    this.el.next.focus({ preventScroll: true });
  },

  // Price history: what the item cost in an older snapshot + % change, with
  // a tiny sparkline once 3+ snapshots exist. Hidden until history exists.
  showHistory(p) {
    const el = this.el.history;
    el.innerHTML = '';
    el.hidden = true;
    const points = History.data && History.data[p.sku];
    const prev = previousPrice(points, Bank.snapshotDate);
    if (!prev || !Number.isFinite(prev[1]) || prev[1] <= 0) return;
    const diff = Math.round((p.price - prev[1]) / prev[1] * 100);
    const label = document.createElement('span');
    label.textContent = 'Verð ' + prev[0] + ': ' + formatKr(prev[1]);
    const change = document.createElement('span');
    change.className = 'history-change';
    change.textContent = diff === 0 ? 'óbreytt' : (diff > 0 ? '+' : '') + diff + '%';
    el.appendChild(label);
    el.appendChild(change);
    if (points.length >= 3) el.appendChild(this.sparkline(points));
    el.hidden = false;
  },

  sparkline(points) {
    const wrap = document.createElement('span');
    wrap.className = 'spark-wrap';
    const prices = points.map((pt) => pt[1]);
    const lo = Math.min(...prices), hi = Math.max(...prices);
    const span = hi - lo || 1;
    const coords = points.map((pt, i) =>
      (2 + i / (points.length - 1) * 96).toFixed(1) + ',' + (22 - (pt[1] - lo) / span * 16).toFixed(1)).join(' ');
    wrap.innerHTML = '<svg width="100" height="24" viewBox="0 0 100 24" aria-hidden="true">' +
      '<polyline points="' + coords + '" fill="none" stroke="#f2c14e" stroke-width="2"/></svg>';
    return wrap;
  },

  next() {
    this.idx++;
    if (this.idx < this.items.length) this.showGuess(); else this.finish();
  },
  finish() {
    const bonus = this.thursday && this.mode === 'daily';
    if (bonus) {
      const prev = Lengja.totalCm;
      Lengja.addSlice(THURSDAY_CM, 'thursday', true);
      this.updateCm();
      this.checkMilestones(prev, Lengja.totalCm);
    }
    const total = totalCm(this.guesses, bonus);
    const res = {
      number: this.number, date: Daily.today(), guesses: this.guesses,
      totalCm: total, thursdayBonus: bonus,
    };
    if (this.mode === 'daily') Daily.recordResult(res);
    else Daily.recordUnlimited(total);
    this.lastResult = res;
    this.showResults(res);
  },

  showResults(res) {
    this.phase = 'results';
    this.el.start.hidden = true;
    this.el.guess.hidden = true; this.el.reveal.hidden = true; this.el.results.hidden = false;
    const daily = this.mode === 'daily';
    this.el.rTitle.textContent = daily ? 'Lengjan þín er tilbúin!' : 'Ótakmörkuð lengja!';
    this.el.rCm.textContent = res.totalCm + ' cm';
    this.el.rRank.textContent = rankFor(res.totalCm);
    this.el.receipt.innerHTML = '';
    for (const g of res.guesses) {
      const t = tierById(g.tierId);
      const item = document.createElement('div');
      item.className = 'r-item';
      const nm = document.createElement('div');
      nm.className = 'r-name';
      nm.textContent = t.emoji + ' ' + g.name;
      const row = document.createElement('div');
      row.className = 'r-row';
      const a = document.createElement('span');
      a.textContent = formatKr(g.guess) + ' → ' + formatKr(g.price);
      const b = document.createElement('span');
      b.textContent = '+' + g.cm + ' cm';
      row.appendChild(a); row.appendChild(b);
      item.appendChild(nm); item.appendChild(row);
      this.el.receipt.appendChild(item);
    }
    if (res.thursdayBonus) {
      const bonus = document.createElement('div');
      bonus.className = 'r-row bonus-row';
      bonus.innerHTML = '<span>🥐 Fimmtudagsbonus — vínarbrauð í kaffi!</span><span>+' + THURSDAY_CM + ' cm</span>';
      this.el.receipt.appendChild(bonus);
    }
    this.el.rNote.textContent = daily
      ? 'Verð miðað við verðskrá Krónunnar ' + Bank.snapshotDate + '.'
      : 'Besta ótakmarkaða lengja: ' + (Daily.load().bestUnlimited || 0) + ' cm.';
    this.el.share.hidden = !daily;
    this.el.lbBtn.hidden = !daily;
    this.el.backDaily.hidden = daily;
    this.el.tomorrow.textContent = daily ? 'Ný karfa á morgun — komdu aftur! 🔥' : '';
    const s = daily ? this.streakLine() : '';
    this.el.rStreak.textContent = s;
    this.el.rStreak.hidden = !s;
  },

  // Stats modal: days played, streaks, tier distribution, average error and
  // the recent lengjur - all computed from the saved localStorage results.
  openStats() {
    const data = Daily.load();
    const days = Object.keys(data.results).sort();
    const body = this.el.statsBody;
    body.innerHTML = '';
    const row = (parent, label, value) => {
      const r = document.createElement('div');
      r.className = 'r-row';
      const a = document.createElement('span'); a.textContent = label;
      const b = document.createElement('span'); b.textContent = value;
      r.appendChild(a); r.appendChild(b);
      parent.appendChild(r);
    };
    const receipt = () => {
      const r = document.createElement('div');
      r.className = 'receipt';
      body.appendChild(r);
      return r;
    };
    if (!days.length) {
      const p = document.createElement('p');
      p.textContent = 'Enginn bakstur skráður ennþá — bakaðu þína fyrstu lengju!';
      body.appendChild(p);
    } else {
      const all = days.map((d) => data.results[d]);
      const guesses = all.flatMap((r) => r.guesses);
      const best = all.reduce((m, r) => Math.max(m, r.totalCm), 0);
      const avgErr = guesses.length ? guesses.reduce((s, g) => s + (g.error || 0), 0) / guesses.length : 0;
      let longest = 1, run = 1;
      for (let i = 1; i < days.length; i++) {
        run = Date.parse(days[i] + 'T00:00:00Z') - Date.parse(days[i - 1] + 'T00:00:00Z') === 86400000 ? run + 1 : 1;
        if (run > longest) longest = run;
      }
      const sum = receipt();
      row(sum, 'Dagar bakaðir', String(days.length));
      row(sum, 'Núverandi röð', (data.streak || 0) + ' 🔥');
      row(sum, 'Lengsta röð', String(longest));
      row(sum, 'Besta lengja', best + ' cm');
      row(sum, 'Meðalfrávik', Math.round(avgErr * 100) + '%');
      row(sum, 'Ótakmarkað met', (data.bestUnlimited || 0) + ' cm');
      const tiers = receipt();
      for (const t of TIERS) {
        row(tiers, t.emoji + ' ' + t.name, String(guesses.filter((g) => g.tierId === t.id).length));
      }
      const h = document.createElement('p');
      h.className = 'stats-sub';
      h.textContent = 'Síðustu lengjur';
      body.appendChild(h);
      const recent = receipt();
      for (const d of days.slice(-7).reverse()) {
        const r = data.results[d];
        row(recent, '#' + r.number + ' · ' + d,
          r.guesses.map((g) => tierById(g.tierId).emoji).join('') + ' ' + r.totalCm + ' cm');
      }
    }
    this.el.stats.hidden = false;
  },

  // Rebuild today's finished lengja from the saved result (no animations).
  showSaved() {
    const res = Daily.todayResult();
    if (!res) { this.startDaily(); return; }
    this.mode = 'daily';
    this.number = res.number;
    this.el.puzzle.textContent = '#' + res.number + ' · dagleg karfa';
    Lengja.reset();
    for (const g of res.guesses) Lengja.addSlice(g.cm, g.tierId, false);
    if (res.thursdayBonus) Lengja.addSlice(THURSDAY_CM, 'thursday', false);
    this.updateCm();
    this.lastResult = res;
    this.showResults(res);
  },

  share() {
    if (!this.lastResult) return;
    const ok = Daily.copyShare(this.lastResult);
    if (ok) {
      this.el.share.textContent = 'Afritað! ✓';
      setTimeout(() => { this.el.share.textContent = 'Deila 📋'; }, 2000);
    } else {
      this.el.rNote.textContent = Daily.shareText(this.lastResult);
    }
  },

  // Leaderboard: with cached credentials this is one click; otherwise a
  // small name + PIN modal (login, or auto-register for new players).
  async openLeaderboard() {
    if (!this.lastResult || this.mode !== 'daily') return;
    const saved = Leaderboard.player();
    if (saved && saved.name && saved.pin) {
      this.el.lbBtn.textContent = 'Sendi… 🥐';
      try {
        await Leaderboard.submit(this.lastResult, saved);
        this.el.lbBtn.textContent = 'Sent á stigatöfluna ✓';
      } catch (e) {
        this.el.lbBtn.textContent = 'Senda á stigatöfluna 🏆';
        this.showLbModal(e.message || 'Tókst ekki að senda skor.');
      }
    } else {
      this.showLbModal('');
    }
  },

  showLbModal(msg) {
    const saved = Leaderboard.player();
    if (saved) {
      this.el.lbName.value = saved.name || '';
      this.el.lbPin.value = saved.pin || '';
    }
    this.el.lbMsg.textContent = msg;
    this.el.lbMsg.hidden = !msg;
    this.el.lb.hidden = false;
  },

  async submitToLeaderboard() {
    if (!this.lastResult) return;
    const name = String(this.el.lbName.value).trim();
    const pin = String(this.el.lbPin.value).trim();
    if (!name || !/^\d{4}$/.test(pin)) {
      this.el.lbMsg.textContent = 'Nafn vantar eða PIN er ekki 4 tölustafir.';
      this.el.lbMsg.hidden = false;
      return;
    }
    this.el.lbMsg.textContent = 'Sendi… 🥐';
    this.el.lbMsg.hidden = false;
    try {
      const player = await Leaderboard.login(name, pin);
      await Leaderboard.submit(this.lastResult, player);
      this.el.lb.hidden = true;
      this.el.lbBtn.textContent = 'Sent á stigatöfluna ✓';
    } catch (e) {
      this.el.lbMsg.textContent = e.message || 'Tókst ekki að senda skor.';
      this.el.lbMsg.hidden = false;
    }
  },

  // The one big celebration: 100 cm = Metralengjan. No ruler flags.
  checkMilestones(prev, now) {
    if (!(prev < 100 && now >= 100)) return;
    this.el.banner.textContent = '🏆 METRALENGJAN! 🏆';
    this.el.banner.hidden = false;
    this.sfx.fanfare();
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => { this.el.banner.hidden = true; }, 2600);
  },

  updateCm() { this.el.cm.textContent = Lengja.totalCm + ' cm'; },
};

window.addEventListener('DOMContentLoaded', () => Game.boot());