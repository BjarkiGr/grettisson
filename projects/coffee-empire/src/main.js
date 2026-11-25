/* COFFEE EMPIRE — bootstrap, centralized game loop, audio. */
(function (global) {
'use strict';
const CE = global.CE = global.CE || {};
const E = CE.Engine, UI = CE.UI;

/* ---------- Audio (procedural, no assets) ---------- */
const Audio = CE.Audio = {
  ctx: null, musicTimer: null, musicOn: false,
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (global.AudioContext || global.webkitAudioContext)(); } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  volume() {
    const v = CE.S && CE.S.settings.volume != null ? CE.S.settings.volume : 70;
    return Math.max(0, Math.min(100, v)) / 100;
  },
  blip(freq, dur) {
    if (!CE.S || !CE.S.settings.sound) return;
    const vol = this.volume();
    if (vol <= 0) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.05 * vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  },
  /* Distinct feedback cues: brewing, register, purchase, upgrade, achievement, research, events */
  cue(type) {
    const seq = {
      achievement: [[523, 0.09], [659, 0.09], [784, 0.09], [1047, 0.16]],
      research: [[660, 0.08], [880, 0.14]],
      register: [[880, 0.05], [1320, 0.09]],
      purchase: [[520, 0.06]],
      upgrade: [[700, 0.06], [940, 0.1]],
      event: [[330, 0.09], [262, 0.12]],
      brew: [[660, 0.05]]
    }[type];
    if (!seq) return;
    seq.forEach(([f, d], i) => setTimeout(() => this.blip(f, d), i * 90));
  },
  setMusic(on) {
    this.musicOn = on;
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
    if (!on) return;
    const chords = [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 311.1]];
    let i = 0;
    const play = () => {
      const ctx = this.ensure();
      if (!ctx || !this.musicOn) return;
      const chord = chords[i++ % chords.length];
      for (const f of chord) {
        const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
        o.type = 'triangle'; o.frequency.value = f / 2;
        lp.type = 'lowpass'; lp.frequency.value = 600;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.025 * this.volume(), ctx.currentTime + 1.2);
        g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 3.8);
        o.connect(lp); lp.connect(g); g.connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + 4);
      }
    };
    play();
    this.musicTimer = setInterval(play, 4000);
  }
};

/* ---------- Boot ---------- */
function boot() {
  let S = CE.load();
  let offlineSum = null;
  if (S) {
    const away = (Date.now() - S.lastSaved) / 1000;
    E.dirty = true;
    if (S.settings.offline && away > 60) {
      try { offlineSum = E.simulateOffline(S, away); } catch (e) { offlineSum = null; }
    }
  } else {
    S = CE.newState();
    CE.applyLegacyStart(S);
    CE.notify('Welcome to Coffee Empire! Brew coffee, hire staff, build your empire.', 'good');
  }
  CE.S = S;
  CE.fmtMode = S.settings.fmt;
  E.lastSample = null;
  if (CE.loadWarning) CE.notify(CE.loadWarning, 'warn');
  document.body.classList.toggle('no-anim', !S.settings.animations);
  /* Brew is the primary screen during early progression; the dashboard
     takes over once the player has sold 100 coffees. */
  if (S.stats.cups < 100) S.ui.section = 'brew';
  UI.init(S);
  UI.sig = UI.signature(S);
  if (offlineSum) UI.offlineModal(offlineSum);
  if (S.settings.music) Audio.setMusic(true);

  /* ---------- Centralized loop: 8 Hz simulation ---------- */
  let last = performance.now();
  let frame = 0, saveAcc = 0;
  setInterval(() => {
    const now = performance.now();
    let dt = (now - last) / 1000;
    last = now;
    if (dt <= 0) return;
    if (dt > 300) dt = 300; /* extremely long tab sleep: cap, offline load handles the rest */
    E.tick(CE.S, dt);
    UI.drainNotifications();
    frame++;
    if (frame % 2 === 0) UI.update();          /* 4 Hz UI */
    if (frame % 8 === 0) UI.checkStructure();  /* 1 Hz structural rebuild */
    saveAcc += dt;
    if (saveAcc >= Math.max(5, CE.S.settings.autosave)) {
      saveAcc = 0;
      CE.save(CE.S);
    }
  }, 125);

  global.addEventListener('beforeunload', () => CE.save(CE.S));
  document.addEventListener('visibilitychange', () => { if (document.hidden) CE.save(CE.S); });
  /* Unlock audio on first interaction */
  document.addEventListener('pointerdown', function once() {
    Audio.ensure();
    document.removeEventListener('pointerdown', once);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})(typeof window !== 'undefined' ? window : globalThis);
