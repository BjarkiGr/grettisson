// Orchestrates everything: input -> update -> draw, camera, combat,
// scoring/combos, HUD and the title screen.
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input();
    this.sfx = new Sfx();
    this.particles = new Particles();
    this.world = new World();
    this.state = 'title';
    this.time = 0;
    this.cam = { x: 0, shakeT: 0, shakeDur: 1, shakeMag: 0 };
    this.resetRun();
  }

  resetRun() {
    this.world.reset();
    this.godzilla = new Godzilla(220);
    this.startX = this.godzilla.x;
    this.score = 0;
    this.smashed = 0;
    this.combo = 1;
    this.comboT = 0;
    this.cam.x = 0;
    this.particles.list.length = 0;
    this.world.update(0, this.canvas.width);
  }

  get groundY() { return this.canvas.height - 90; }

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
    if (this.state === 'title') {
      if (inp.hit('enter', ' ')) {
        this.sfx.unlock();
        this.state = 'playing';
      }
      return;
    }
    const g = this.godzilla;
    const gy = this.groundY;
    // roar
    if (inp.hit('r') && g.startRoar()) {
      this.sfx.roar();
      this.shake(9, 0.7);
      this.particles.popup(g.x, gy - g.height - 30, 'ROAAR!', '#ffd23e', 30);
      for (const b of this.world.buildings) {
        if (Math.abs(b.x + b.w / 2 - g.x) < 650) b.scare();
      }
    }
    // attack
    if (inp.hit(' ', 'j') && g.startAttack()) this.sfx.whoosh();
    // movement
    let move = 0;
    if (inp.down('arrowleft', 'a')) move -= 1;
    if (inp.down('arrowright', 'd')) move += 1;
    const ev = g.update(dt, move, this.world.buildings);
    if (ev.stepped) {
      this.sfx.stomp();
      this.shake(2.5, 0.12);
      this.particles.dust(g.x - g.facing * 30, gy - 4, 2);
    }
    if (ev.hit) this.resolveAttack();
    // buildings
    for (const b of this.world.buildings) {
      b.update(dt);
      if (b.state === 'collapsing' && Math.random() < 0.6) {
        const p = b.collapseT / b.collapseDur;
        this.particles.dust(b.x + rand(0, b.w), gy - b.h * (1 - p) * 0.5, 1);
      }
    }
    // combo decay
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 1;
    }
    this.world.update(this.cam.x, this.canvas.width);
    this.particles.update(dt, gy);
    // smooth-follow camera
    const target = g.x - this.canvas.width * 0.38;
    this.cam.x += (target - this.cam.x) * (1 - Math.exp(-5 * dt));
    this.cam.x = Math.max(0, this.cam.x);
    if (this.cam.shakeT > 0) this.cam.shakeT -= dt;
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
      const iy = gy - Math.min(b.h, g.height) * rand(0.35, 0.75);
      const result = b.hit(1);
      this.particles.debris(ix, iy, 14, [b.color, '#2b2b30', '#55565e']);
      this.score += 10;
      if (result === 'destroyed') {
        const pts = 100 * this.combo;
        this.score += pts;
        this.smashed++;
        this.particles.popup(b.x + b.w / 2, gy - b.h - 20, '+' + pts, '#ffd23e', 26);
        if (this.combo > 1) this.particles.popup(g.x, gy - g.height - 50, 'COMBO x' + this.combo, '#ff7b54', 22);
        this.combo = Math.min(this.combo + 1, 9);
        this.comboT = 3;
        this.particles.debris(b.x + b.w / 2, gy - b.h * 0.5, 30, [b.color, '#2b2b30', '#55565e']);
        this.particles.dust(b.x + b.w / 2, gy - 20, 14);
        this.sfx.crumble();
        this.shake(13, 0.5);
      } else {
        this.particles.popup(ix, iy - 20, '+10', '#e8e8e8', 18);
        this.sfx.hit();
        this.shake(5, 0.18);
      }
    }
    if (!any) this.sfx.whoosh();
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const gy = this.groundY;
    let camX = this.cam.x;
    let oy = 0;
    if (this.cam.shakeT > 0) {
      const k = (this.cam.shakeT / this.cam.shakeDur) * this.cam.shakeMag;
      camX += rand(-k, k);
      oy = rand(-k, k);
    }
    ctx.save();
    ctx.translate(0, oy);
    this.world.draw(ctx, camX, w, h, gy, this.time);
    for (const b of this.world.buildings) b.draw(ctx, camX, gy, this.time);
    this.godzilla.draw(ctx, camX, gy, this.time);
    this.particles.draw(ctx, camX);
    ctx.restore();
    this.drawHud(ctx, w, h);
    if (this.state === 'title') this.drawTitle(ctx, w, h);
  }

  drawHud(ctx, w, h) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(14, 14, 250, this.combo > 1 ? 108 : 84);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('SCORE ' + String(this.score).padStart(6, '0'), 26, 46);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '16px monospace';
    const dist = Math.max(0, Math.round((this.godzilla.x - this.startX) / 50));
    ctx.fillText('SMASHED ' + this.smashed + '   ' + dist + ' m', 26, 72);
    if (this.combo > 1) {
      ctx.fillStyle = '#ff7b54';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('COMBO x' + this.combo, 26, 98);
      ctx.fillStyle = 'rgba(255,123,84,0.35)';
      ctx.fillRect(150, 86, 100, 12);
      ctx.fillStyle = '#ff7b54';
      ctx.fillRect(150, 86, 100 * clamp(this.comboT / 3, 0, 1), 12);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    let hint = 'ARROWS / A,D move    SPACE smash    R roar    M mute';
    if (this.sfx.muted) hint += '    [MUTED]';
    ctx.fillText(hint, w / 2, h - 16);
    ctx.textAlign = 'left';
  }

  drawTitle(ctx, w, h) {
    ctx.fillStyle = 'rgba(8,6,18,0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e63946';
    ctx.font = 'bold 88px monospace';
    ctx.fillText('GODZILLA', w / 2, h * 0.34);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 30px monospace';
    ctx.fillText('C I T Y   R A M P A G E', w / 2, h * 0.34 + 46);
    if (Math.sin(this.time * 4) > -0.2) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('PRESS ENTER TO START', w / 2, h * 0.55);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '16px monospace';
    ctx.fillText('Walk right. Smash everything. Chain smashes for combos.', w / 2, h * 0.55 + 40);
    ctx.textAlign = 'left';
  }
}
