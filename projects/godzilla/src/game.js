// Orchestrates everything: input -> update -> draw, camera, combat,
// scoring/combos, HUD, title screen, daily results and sharing.
// Modes: 'daily' (date-seeded 500m score attack) and 'unlimited' (endless).
const DAILY_LEN = 500 * METER; // 4 city stretches + 3 swim sections, finish on land

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input();
    this.touchUI = null; // set by TouchUI (src/touch.js)
    this.sfx = new Sfx();
    this.particles = new Particles();
    this.world = new World();
    this.state = 'title';
    this.time = 0;
    this.dailyData = Daily.load();
    this.result = null;
    this.shareCopiedT = 0;
    this.resetRun('daily');
    // clicking the results screen also copies the share text
    if (canvas.addEventListener) {
      canvas.addEventListener('click', () => { if (this.state === 'results') this.copyShare(); });
    }
  }

  resetRun(mode) {
    this.mode = mode;
    if (mode === 'daily') setSeed(Daily.today()); else clearSeed();
    this.world.reset();
    this.godzilla = new Godzilla(220);
    this.startX = this.godzilla.x;
    this.finishX = this.startX + DAILY_LEN;
    this.score = 0;
    this.smashed = 0;
    this.boatKills = 0;
    this.combo = 1;
    this.comboT = 0;
    this.maxCombo = 1;
    this.elapsed = 0;
    this.beamTicks = 0;
    this.beamHits = 0;
    this.beamTickT = 0;
    this.wasBeaming = false;
    // per-segment stats for the share grid: city, water, city, water, ...
    this.segments = Array.from({ length: 7 }, (_, i) => ({ water: i % 2 === 1, smashed: 0, kills: 0 }));
    this.cam = { x: 0, shakeT: 0, shakeDur: 1, shakeMag: 0 };
    this.particles.list.length = 0;
    this.world.update(0, this.viewW);
    this.result = null;
  }

  // View metrics. The backing store is device pixels (canvas.dpr), the HUD
  // is drawn in CSS pixels, and the world is drawn in logical pixels that
  // shrink on small screens so ~900x540 of world always stays visible.
  get dpr() { return this.canvas.dpr || 1; }
  get cssW() { return this.canvas.width / this.dpr; }
  get cssH() { return this.canvas.height / this.dpr; }
  get viewScale() { return this.dpr * Math.min(1, this.cssW / 900, this.cssH / 540); }
  get viewW() { return this.canvas.width / this.viewScale; }
  get viewH() { return this.canvas.height / this.viewScale; }
  get groundY() { return this.viewH - 90; }

  segIndexFor(x) {
    const idx = Math.floor(x / CYCLE_LEN) * 2 + (this.world.isWater(x) ? 1 : 0);
    return clamp(idx, 0, this.segments.length - 1);
  }

  shake(mag, dur) {
    if (mag >= this.cam.shakeMag || this.cam.shakeT <= 0) {
      this.cam.shakeMag = mag;
      this.cam.shakeDur = dur;
      this.cam.shakeT = dur;
    }
  }
  update(dt) {
    this.time += dt;
    const inp = this.input;
    if (inp.hit('m')) this.sfx.toggleMute();
    if (this.shareCopiedT > 0) this.shareCopiedT -= dt;
    if (this.state === 'title') {
      if (inp.hit('enter', ' ')) {
        this.sfx.unlock();
        if (Daily.playedToday()) {
          this.result = Daily.todayResult();
          this.dailyData = Daily.load();
          this.state = 'results';
        } else {
          this.resetRun('daily');
          this.state = 'playing';
        }
      }
      if (inp.hit('u')) {
        this.sfx.unlock();
        this.resetRun('unlimited');
        this.state = 'playing';
      }
      return;
    }
    if (this.state === 'results') {
      if (inp.hit('c')) this.copyShare();
      if (inp.hit('u')) { this.resetRun('unlimited'); this.state = 'playing'; }
      if (inp.hit('escape')) { this.dailyData = Daily.load(); this.state = 'title'; }
      return;
    }
    // --- playing ---
    if (inp.hit('escape')) { this.endRun(); return; }
    this.elapsed += dt;
    const g = this.godzilla;
    const gy = this.groundY;
    const inWater = this.world.isWater(g.x);
    // auto-walk: forward by default, brake / sprint modifiers
    let move = 1;
    if (inp.down('arrowleft', 'a')) move = 0;
    else if (inp.down('arrowright', 'd')) move = 1.6;
    if (inp.hit('arrowup', 'w') && !inWater && g.startJump()) this.sfx.jump();
    const depthMove = inWater
      ? (inp.down('arrowdown', 's') ? 1 : 0) - (inp.down('arrowup', 'w') ? 1 : 0)
      : 0;
    // roar
    if (inp.hit('r') && g.startRoar()) {
      this.sfx.roar();
      this.shake(9, 0.7);
      this.particles.popup(g.x, gy - g.height - 30, 'ROAAR!', '#ffd23e', 30);
      for (const b of this.world.buildings) {
        if (Math.abs(b.x + b.w / 2 - g.x) < 650) b.scare();
      }
    }
    // attack / body slam
    if (inp.hit(' ', 'j') && g.startAttack() && !g.airborne) this.sfx.whoosh();
    // atomic beam (hold)
    g.setBeam(inp.down('f', 'k'));
    if (g.beamOn && !this.wasBeaming) this.sfx.beamStart();
    this.wasBeaming = g.beamOn;
    const ev = g.update(dt, move, this.world.buildings, inWater, depthMove);
    if (ev.waterChanged) {
      this.sfx.splash();
      this.particles.splash(g.x, gy, 26);
      this.shake(6, 0.3);
    }
    if (inWater && Math.random() < 0.15) this.particles.bubbles(g.x - 60, gy + 30 + g.swimDepth, 1);
    if (ev.stepped) {
      this.sfx.stomp();
      this.shake(2.5, 0.12);
      this.particles.dust(g.x - g.facing * 30, gy - 4, 2);
    }
    if (ev.landed) {
      this.sfx.land();
      this.shake(ev.slam ? 12 : 7, 0.35);
      this.particles.dust(g.x, gy - 4, ev.slam ? 22 : 10);
      // landing shockwave damages nearby buildings (bigger after a slam)
      const radius = ev.slam ? 220 : 130;
      for (const b of this.world.buildings) {
        if (!b.solid) continue;
        const cx = b.x + b.w / 2;
        if (Math.abs(cx - g.x) < radius + b.w / 2) {
          this.damageBuilding(b, 1, cx, gy - Math.min(b.h, 120));
        }
      }
    }
    if (ev.hit) this.resolveAttack();
    if (g.beamOn) this.fireBeam(dt, gy);
    // buildings
    for (const b of this.world.buildings) {
      b.update(dt);
      if (b.state === 'collapsing' && Math.random() < 0.6) {
        const p = b.collapseT / b.collapseDur;
        this.particles.dust(b.x + crand(0, b.w), gy - b.h * (1 - p) * 0.5, 1);
      }
    }
    // boats + shells
    for (const boat of this.world.boats) {
      boat.update(dt, g.x);
      boat.shells = boat.shells.filter((s) => {
        if (Math.abs(s.x - g.x) < 55) {
          const gTop = inWater ? 92 - g.swimDepth : 245 + g.y;
          const gBottom = inWater ? -30 : g.y - 10;
          if (s.h < gTop && s.h > gBottom) { this.shellHit(s); return false; }
        }
        if (s.h <= 0) { this.particles.splash(s.x, gy, 8); return false; }
        return true;
      });
    }
    // combo decay
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 1;
    }
    this.world.update(this.cam.x, this.viewW);
    this.particles.update(dt, gy);
    // smooth-follow camera
    const target = g.x - this.viewW * 0.38;
    this.cam.x += (target - this.cam.x) * (1 - Math.exp(-5 * dt));
    this.cam.x = Math.max(0, this.cam.x);
    if (this.cam.shakeT > 0) this.cam.shakeT -= dt;
    // daily finish line
    if (this.mode === 'daily' && g.x >= this.finishX) this.finishDaily();
  }
  // Shared damage pipeline for swipe, shockwave and beam.
  damageBuilding(b, dmg, ix, iy) {
    const result = b.hit(dmg);
    if (!result) return null;
    const g = this.godzilla;
    const gy = this.groundY;
    if (result === 'destroyed') {
      const pts = 100 * this.combo;
      this.score += pts;
      this.smashed++;
      g.energy = Math.min(100, g.energy + 6);
      this.segments[this.segIndexFor(b.x + b.w / 2)].smashed++;
      this.particles.popup(b.x + b.w / 2, gy - b.h - 20, '+' + pts, '#ffd23e', 26);
      if (this.combo > 1) this.particles.popup(g.x, gy - g.height - 50, 'COMBO x' + this.combo, '#ff7b54', 22);
      this.combo = Math.min(this.combo + 1, 9);
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.comboT = 3;
      this.particles.debris(b.x + b.w / 2, gy - b.h * 0.5, 30, [b.color, '#2b2b30', '#55565e']);
      this.particles.dust(b.x + b.w / 2, gy - 20, 14);
      this.sfx.crumble();
      this.shake(13, 0.5);
    } else {
      this.score += 10;
      this.particles.popup(ix, iy - 20, '+10', '#e8e8e8', 18);
      this.sfx.hit();
      this.shake(5, 0.18);
    }
    return result;
  }

  resolveAttack() {
    const g = this.godzilla;
    const gy = this.groundY;
    const r = g.attackRange();
    const lo = Math.min(r.from, r.to);
    const hi = Math.max(r.from, r.to);
    let any = false;
    for (const b of this.world.buildings) {
      if (!b.solid || b.right < lo || b.left > hi) continue;
      any = true;
      const ix = clamp(g.x + g.facing * 90, b.left, b.right);
      const iy = gy - Math.min(b.h, g.height) * crand(0.35, 0.75);
      this.damageBuilding(b, 1, ix, iy);
    }
    if (!any) this.sfx.whoosh();
  }

  fireBeam(dt, gy) {
    this.beamTickT -= dt;
    if (this.beamTickT > 0) return;
    this.beamTickT = 0.15;
    this.beamTicks++;
    const g = this.godzilla;
    const m = g.mouthPos(gy);
    const to = m.x + g.facing * 700;
    const lo = Math.min(m.x, to), hi = Math.max(m.x, to);
    let hitAny = false;
    for (const b of this.world.buildings) {
      if (!b.solid || b.right < lo || b.left > hi) continue;
      hitAny = true;
      const ix = clamp(m.x + g.facing * 120, b.left, b.right);
      const iy = gy - Math.min(b.h, 222);
      this.particles.sparks(ix, iy, 6, '#ff8fc0');
      this.damageBuilding(b, 1, ix, iy);
    }
    for (const boat of this.world.boats) {
      if (!boat.afloat || boat.right < lo || boat.left > hi) continue;
      hitAny = true;
      this.particles.sparks(boat.x, gy - 20, 6, '#ff8fc0');
      const r = boat.hit(1);
      if (r === 'sunk') {
        this.boatKills++;
        this.score += 300;
        this.segments[this.segIndexFor(boat.x)].kills++;
        this.particles.popup(boat.x, gy - 60, '+300', '#ffd23e', 24);
        this.particles.debris(boat.x, gy - 10, 20, ['#5b6570', '#78838f', '#39424c']);
        this.particles.splash(boat.x, gy, 20);
        this.sfx.boatSink();
        this.shake(8, 0.4);
      } else if (r) {
        this.sfx.boatHit();
      }
    }
    if (hitAny) { this.beamHits++; this.shake(3, 0.12); }
    this.sfx.beam();
  }

  shellHit(s) {
    const g = this.godzilla;
    const gy = this.groundY;
    this.score = Math.max(0, this.score - 150);
    this.combo = 1;
    this.comboT = 0;
    g.stun(0.7);
    this.sfx.shellHit();
    this.shake(8, 0.35);
    this.particles.popup(g.x, gy - g.height - 20, '-150', '#e63946', 26);
    this.particles.sparks(s.x, gy - s.h, 12, '#ffef9e');
  }
  finishDaily() {
    const timeBonus = Math.max(0, Math.round((240 - this.elapsed) * 10));
    this.score += timeBonus;
    this.result = {
      number: Daily.number(),
      date: Daily.today(),
      score: this.score,
      smashed: this.smashed,
      boatKills: this.boatKills,
      maxCombo: this.maxCombo,
      time: this.elapsed,
      timeBonus,
      beamTicks: this.beamTicks,
      beamHits: this.beamHits,
      segments: this.segments,
    };
    this.dailyData = Daily.recordResult(this.result);
    this.state = 'results';
    this.sfx.finish();
  }

  // ESC: end an unlimited run (saves best) or abandon the daily (retryable).
  endRun() {
    if (this.mode === 'unlimited') {
      const data = Daily.load();
      if (this.score > (data.bestUnlimited || 0)) {
        data.bestUnlimited = this.score;
        Daily.save(data);
      }
    }
    this.dailyData = Daily.load();
    this.state = 'title';
  }

  copyShare() {
    if (this.result && Daily.copyShare(this.result)) this.shareCopiedT = 2;
  }

  fmtTime(t) {
    return Math.floor(t / 60) + ':' + String(Math.round(t % 60)).padStart(2, '0');
  }

  draw() {
    const ctx = this.ctx;
    const s = this.viewScale;
    const w = this.viewW;
    const h = this.viewH;
    const gy = this.groundY;
    let camX = this.cam.x;
    let oy = 0;
    if (this.cam.shakeT > 0) {
      const k = (this.cam.shakeT / this.cam.shakeDur) * this.cam.shakeMag;
      camX += crand(-k, k);
      oy = crand(-k, k);
    }
    // world pass in logical pixels (scaled down on small screens)
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.save();
    ctx.translate(0, oy);
    this.world.draw(ctx, camX, w, h, gy, this.time);
    for (const b of this.world.buildings) b.draw(ctx, camX, gy, this.time);
    this.godzilla.draw(ctx, camX, gy, this.time);
    // water is painted over Godzilla so his submerged body shows through
    this.world.drawWater(ctx, camX, w, h, gy, this.time);
    for (const boat of this.world.boats) boat.draw(ctx, camX, gy, this.time);
    if (this.godzilla.beamOn) this.drawBeam(ctx, camX, gy);
    if (this.mode === 'daily' && this.state === 'playing') this.drawFinish(ctx, camX, w, gy);
    this.particles.draw(ctx, camX);
    ctx.restore();
    // HUD + menus in CSS pixels so text stays readable on phones
    const d = this.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const cw = this.cssW, ch = this.cssH;
    this.drawHud(ctx, cw, ch);
    if (this.state === 'title') this.drawTitle(ctx, cw, ch);
    if (this.state === 'results') this.drawResults(ctx, cw, ch);
  }

  drawBeam(ctx, camX, gy) {
    const g = this.godzilla;
    const m = g.mouthPos(gy);
    const sx = m.x - camX, sy = m.y;
    const len = 700 * g.facing;
    const x0 = Math.min(sx, sx + len);
    const flick = 1 + Math.sin(this.time * 45) * 0.15;
    ctx.save();
    ctx.shadowColor = '#ff5fa2';
    ctx.shadowBlur = 24;
    ctx.fillStyle = 'rgba(255,95,162,0.30)';
    ctx.fillRect(x0, sy - 15 * flick, Math.abs(len), 30 * flick);
    ctx.fillStyle = '#ff5fa2';
    ctx.fillRect(x0, sy - 7 * flick, Math.abs(len), 14 * flick);
    ctx.fillStyle = '#ffd7ef';
    ctx.fillRect(x0, sy - 3, Math.abs(len), 6);
    // muzzle glow
    ctx.fillStyle = 'rgba(255,215,239,0.9)';
    ctx.beginPath();
    ctx.arc(sx, sy, 12 * flick, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawFinish(ctx, camX, w, gy) {
    const sx = this.finishX - camX;
    if (sx < -120 || sx > w + 120) return;
    ctx.fillStyle = '#d8d8d0';
    ctx.fillRect(sx, gy - 320, 6, 320);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#111111' : '#ffffff';
        ctx.fillRect(sx + 6 + c * 14, gy - 320 + r * 14, 14, 14);
      }
    }
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FINISH', sx + 45, gy - 330);
    ctx.textAlign = 'left';
  }
  drawHud(ctx, w, h) {
    const g = this.godzilla;
    const touch = !!(this.touchUI && this.touchUI.enabled);
    const u = w < 700 ? 0.72 : 1; // compact HUD on phone-sized screens
    const boxH = (this.combo > 1 ? 148 : 110) * u;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(14 * u, 14 * u, 250 * u, boxH);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold ' + Math.round(26 * u) + 'px monospace';
    ctx.fillText('SCORE ' + String(this.score).padStart(6, '0'), 26 * u, 46 * u);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = Math.round(16 * u) + 'px monospace';
    const dist = Math.max(0, Math.round((g.x - this.startX) / METER));
    ctx.fillText('SMASHED ' + this.smashed + '   ' + dist + ' m', 26 * u, 72 * u);
    // atomic energy bar
    ctx.fillStyle = 'rgba(255,95,162,0.25)';
    ctx.fillRect(26 * u, 82 * u, 200 * u, 10 * u);
    ctx.fillStyle = '#ff5fa2';
    ctx.fillRect(26 * u, 82 * u, 200 * u * clamp(g.energy / 100, 0, 1), 10 * u);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = Math.round(11 * u) + 'px monospace';
    ctx.fillText(touch ? 'ATOMIC BREATH' : 'ATOMIC BREATH [F]', 26 * u, 104 * u);
    if (this.combo > 1) {
      ctx.fillStyle = '#ff7b54';
      ctx.font = 'bold ' + Math.round(18 * u) + 'px monospace';
      ctx.fillText('COMBO x' + this.combo, 26 * u, 126 * u);
      ctx.fillStyle = 'rgba(255,123,84,0.35)';
      ctx.fillRect(150 * u, 114 * u, 100 * u, 12 * u);
      ctx.fillStyle = '#ff7b54';
      ctx.fillRect(150 * u, 114 * u, 100 * u * clamp(this.comboT / 3, 0, 1), 12 * u);
    }
    // mode panel (top right)
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(w - 214 * u, 14 * u, 200 * u, 84 * u);
    ctx.font = 'bold ' + Math.round(18 * u) + 'px monospace';
    if (this.mode === 'daily') {
      ctx.fillStyle = '#ff5fa2';
      ctx.fillText('DAILY #' + Daily.number(), w - 202 * u, 40 * u);
      ctx.fillStyle = '#e8e8e8';
      ctx.font = Math.round(15 * u) + 'px monospace';
      ctx.fillText(dist + 'm / ' + Math.round(DAILY_LEN / METER) + 'm', w - 202 * u, 62 * u);
      ctx.fillText('TIME ' + this.fmtTime(this.elapsed), w - 202 * u, 82 * u);
    } else {
      ctx.fillStyle = '#7fe7ff';
      ctx.fillText('UNLIMITED', w - 202 * u, 40 * u);
      ctx.fillStyle = '#e8e8e8';
      ctx.font = Math.round(15 * u) + 'px monospace';
      ctx.fillText('BEST ' + (this.dailyData.bestUnlimited || 0), w - 202 * u, 62 * u);
      ctx.fillText(touch ? '✕ to finish' : 'ESC to finish', w - 202 * u, 82 * u);
    }
    // controls hint (keyboard only - the touch buttons are self-labeled)
    if (!touch) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      const inWater = this.world.isWater(g.x);
      let hint = inWater
        ? 'SWIM: UP/DOWN dive & surface    F beam (near surface)    LEFT brake    dodging shells saves points'
        : 'AUTO-WALK    LEFT brake    RIGHT sprint    UP jump    SPACE smash    F beam    R roar    M mute';
      if (this.sfx.muted) hint += '    [MUTED]';
      ctx.fillText(hint, w / 2, h - 16);
    }
    ctx.textAlign = 'left';
  }

  drawTitle(ctx, w, h) {
    const touch = !!(this.touchUI && this.touchUI.enabled);
    const u = clamp(w / 900, 0.42, 1); // scale text down on small screens
    ctx.fillStyle = 'rgba(8,6,18,0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e63946';
    ctx.font = 'bold ' + Math.round(88 * u) + 'px monospace';
    ctx.fillText('GODZILLA', w / 2, h * 0.26);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold ' + Math.round(30 * u) + 'px monospace';
    ctx.fillText('C I T Y   R A M P A G E', w / 2, h * 0.26 + 46 * u);
    const played = Daily.playedToday();
    if (Math.sin(this.time * 4) > -0.2) {
      ctx.fillStyle = '#ff5fa2';
      ctx.font = 'bold ' + Math.round(24 * u) + 'px monospace';
      ctx.fillText(played
        ? (touch ? 'DAILY DONE — VIEW RESULT BELOW' : 'DAILY DONE — ENTER TO VIEW RESULT')
        : (touch ? 'TAP BELOW' : 'ENTER') + ' — DAILY RAMPAGE #' + Daily.number(), w / 2, h * 0.52);
    }
    const today = Daily.todayResult();
    let status = 'STREAK ' + (this.dailyData.streak || 0) + '   BEST UNLIMITED ' + (this.dailyData.bestUnlimited || 0);
    if (today) status += '   TODAY ' + today.score + ' pts';
    if (touch) {
      // menu buttons at the bottom replace the keyboard instructions
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = Math.round(16 * u) + 'px monospace';
      ctx.fillText(status, w / 2, h * 0.52 + 40 * u);
      if (h > w) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = Math.round(14 * u) + 'px monospace';
        ctx.fillText('ROTATE FOR A WIDER VIEW', w / 2, h * 0.52 + 68 * u);
      }
    } else {
      ctx.fillStyle = '#7fe7ff';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('U — UNLIMITED RAMPAGE', w / 2, h * 0.52 + 38);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '16px monospace';
      ctx.fillText(status, w / 2, h * 0.52 + 74);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText('Auto-walk. Smash the city. Swim the straits. Pink beam everything.', w / 2, h * 0.52 + 108);
      ctx.fillText('Same city for everyone each day — one scored run. Chain smashes for combos.', w / 2, h * 0.52 + 132);
    }
    ctx.textAlign = 'left';
  }
  drawResults(ctx, w, h) {
    const r = this.result;
    if (!r) return;
    const touch = !!(this.touchUI && this.touchUI.enabled);
    const u = clamp(w / 900, 0.42, 1); // scale text down on small screens
    ctx.fillStyle = 'rgba(8,6,18,0.72)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5fa2';
    ctx.font = 'bold ' + Math.round(38 * u) + 'px monospace';
    ctx.fillText('DAILY RAMPAGE #' + r.number, w / 2, h * 0.18);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold ' + Math.round(64 * u) + 'px monospace';
    ctx.fillText(String(r.score) + ' PTS', w / 2, h * 0.30);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = Math.round(18 * u) + 'px monospace';
    const beamPct = r.beamTicks > 0 ? Math.round((100 * r.beamHits) / r.beamTicks) : 0;
    ctx.fillText('SMASHED ' + r.smashed + '    BOATS SUNK ' + r.boatKills + '    MAX COMBO x' + r.maxCombo, w / 2, h * 0.40);
    ctx.fillText('TIME ' + this.fmtTime(r.time) + '  (+' + r.timeBonus + ' speed bonus)    BEAM ' + beamPct + '% on target', w / 2, h * 0.40 + 30 * u);
    // segment grid, Wordle style
    const segs = r.segments.map((s) =>
      s.water ? (s.kills > 0 ? '🚤' : '🌊')
              : (s.smashed >= 3 ? '💥' : s.smashed > 0 ? '🏙️' : '⬛')
    ).join(' ');
    ctx.font = Math.round(30 * u) + 'px monospace';
    ctx.fillText(segs, w / 2, h * 0.55);
    ctx.fillStyle = '#ff7b54';
    ctx.font = 'bold ' + Math.round(20 * u) + 'px monospace';
    ctx.fillText('STREAK ' + (this.dailyData.streak || 0), w / 2, h * 0.62);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = Math.round(16 * u) + 'px monospace';
    if (touch) {
      // menu buttons at the bottom replace the keyboard instructions
      ctx.fillText('Come back tomorrow for a new city!', w / 2, h * 0.72);
    } else {
      ctx.fillText('C — COPY RESULT    U — UNLIMITED    ESC — TITLE', w / 2, h * 0.72);
      ctx.fillText('Come back tomorrow for a new city!', w / 2, h * 0.72 + 28);
    }
    if (this.shareCopiedT > 0) {
      ctx.fillStyle = '#7fe77f';
      ctx.font = 'bold ' + Math.round(22 * u) + 'px monospace';
      ctx.fillText('COPIED TO CLIPBOARD!', w / 2, touch ? h * 0.72 + 26 * u : h * 0.82);
    }
    ctx.textAlign = 'left';
  }
}