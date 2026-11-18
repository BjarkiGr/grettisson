const BUILDING_COLORS = ['#8a4b3a', '#a08055', '#5d6b7a', '#7a5c48', '#6b7280', '#946b53'];

// A smashable city building. States: intact -> damaged -> collapsing -> rubble.
class Building {
  constructor(x) {
    this.x = x;
    this.w = rand(90, 190);
    this.h = rand(140, 380);
    this.maxHp = this.h > 300 ? 4 : this.h > 220 ? 3 : 2;
    this.hp = this.maxHp;
    this.state = 'intact';
    this.color = pick(BUILDING_COLORS);
    this.collapseT = 0;
    this.collapseDur = 0.6;
    this.tiltDir = Math.random() < 0.5 ? -1 : 1;
    this.scareT = 0; // window flicker timer after a nearby roar
    this.cracks = [];
    this.roofType = randInt(0, 2); // 0 flat, 1 antenna, 2 water tank
    this.windows = [];
    this.cols = Math.max(1, Math.floor((this.w - 24) / 28));
    this.rows = Math.max(1, Math.floor((this.h - 34) / 36));
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.windows.push({ c, r, lit: Math.random() < 0.65, broken: false });
      }
    }
    // Deterministic rubble mounds so the pile does not shimmer between frames.
    this.rubble = [];
    for (let i = 0; i < 5; i++) {
      this.rubble.push({
        dx: ((i + 0.5) * this.w) / 5 + rand(-8, 8),
        w: this.w / 4 + rand(-6, 10),
        h: rand(12, 30),
      });
    }
  }

  get left() { return this.x; }
  get right() { return this.x + this.w; }
  get solid() { return this.state === 'intact' || this.state === 'damaged'; }

  hit(dmg) {
    if (!this.solid) return null;
    this.hp -= dmg;
    const breakCount = Math.ceil(this.windows.length * 0.3);
    for (let i = 0; i < breakCount; i++) pick(this.windows).broken = true;
    for (let i = 0; i < 3; i++) {
      let px = rand(10, this.w - 10);
      let py = rand(10, this.h - 10);
      const segs = [[px, py]];
      for (let s = 0; s < 4; s++) {
        px += rand(-24, 24);
        py += rand(8, 30);
        segs.push([px, py]);
      }
      this.cracks.push(segs);
    }
    if (this.hp <= 0) {
      this.state = 'collapsing';
      this.collapseT = 0;
      return 'destroyed';
    }
    this.state = 'damaged';
    return 'damaged';
  }

  scare() { if (this.solid) this.scareT = 0.6; }

  update(dt) {
    if (this.scareT > 0) this.scareT -= dt;
    if (this.state === 'collapsing') {
      this.collapseT += dt;
      if (this.collapseT >= this.collapseDur) this.state = 'rubble';
    }
  }

  draw(ctx, camX, groundY, time) {
    const sx = this.x - camX;
    if (this.state === 'rubble') { this.drawRubble(ctx, sx, groundY); return; }
    let h = this.h;
    let tilt = 0;
    let alpha = 1;
    if (this.state === 'collapsing') {
      const p = this.collapseT / this.collapseDur;
      h = this.h * (1 - p * 0.92);
      tilt = this.tiltDir * p * 0.18;
      alpha = 1 - p * 0.35;
    }
    const squash = h / this.h;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(sx + this.w / 2, groundY);
    ctx.rotate(tilt);
    // main block + shaded side + roof lip
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.w / 2, -h, this.w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(this.w / 2 - 14, -h, 14, h);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-this.w / 2 - 3, -h - 6, this.w + 6, 8);
    // roof props (skip while collapsing)
    if (this.state !== 'collapsing') {
      ctx.fillStyle = '#2b2f36';
      if (this.roofType === 1) {
        ctx.fillRect(-2, -h - 36, 4, 30);
        ctx.fillRect(-8, -h - 38, 16, 4);
      } else if (this.roofType === 2) {
        ctx.fillRect(this.w / 2 - 36, -h - 26, 22, 20);
        ctx.fillRect(this.w / 2 - 34, -h - 8, 4, 8);
        ctx.fillRect(this.w / 2 - 20, -h - 8, 4, 8);
      }
    }
    // windows
    for (const wnd of this.windows) {
      const wx = -this.w / 2 + 14 + wnd.c * 28;
      const wy = -h + 16 + wnd.r * 36 * squash;
      if (wy > -14) continue;
      let lit = wnd.lit && !wnd.broken;
      if (this.scareT > 0 && lit && Math.sin(time * 40 + wnd.c * 3 + wnd.r) > 0) lit = false;
      ctx.fillStyle = wnd.broken ? '#10141b' : lit ? '#ffd97a' : '#232b36';
      ctx.fillRect(wx, wy, 16, 20 * squash);
    }
    // cracks
    ctx.strokeStyle = 'rgba(15,15,20,0.75)';
    ctx.lineWidth = 2;
    for (const seg of this.cracks) {
      ctx.beginPath();
      ctx.moveTo(seg[0][0] - this.w / 2, -h + seg[0][1] * squash);
      for (let i = 1; i < seg.length; i++) {
        ctx.lineTo(seg[i][0] - this.w / 2, -h + seg[i][1] * squash);
      }
      ctx.stroke();
    }
    if (this.state === 'damaged') {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(-this.w / 2, -h, this.w, h);
    }
    ctx.restore();
  }

  drawRubble(ctx, sx, groundY) {
    ctx.fillStyle = this.color;
    for (const m of this.rubble) {
      ctx.beginPath();
      ctx.moveTo(sx + m.dx - m.w / 2, groundY);
      ctx.lineTo(sx + m.dx, groundY - m.h);
      ctx.lineTo(sx + m.dx + m.w / 2, groundY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(sx - 6, groundY - 5, this.w + 12, 5);
  }
}
