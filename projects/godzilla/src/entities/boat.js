// Navy patrol boat for the swim sections. Lobs arcing shells at Godzilla
// (dive to dodge them); only the atomic beam can reach and sink it.
// Shell heights are measured above the waterline, positive up.
class Boat {
  constructor(x) {
    this.x = x;
    this.w = 130;
    this.hp = 3;
    this.state = 'sailing';
    this.fireT = rand(1.2, 3.2);
    this.firePeriod = 2.4;
    this.flashT = 0;
    this.sinkT = 0;
    this.shells = [];
    this.bob = rand(0, Math.PI * 2);
  }

  get left() { return this.x - this.w / 2; }
  get right() { return this.x + this.w / 2; }
  get afloat() { return this.state === 'sailing'; }

  hit(dmg) {
    if (!this.afloat) return null;
    this.hp -= dmg;
    if (this.hp <= 0) { this.state = 'sinking'; this.sinkT = 0; return 'sunk'; }
    return 'damaged';
  }

  update(dt, targetX) {
    this.flashT = Math.max(0, this.flashT - dt);
    if (this.state === 'sinking') {
      this.sinkT += dt;
    } else {
      this.fireT -= dt;
      // Only engage Godzilla when he is nearby in the water.
      if (this.fireT <= 0 && Math.abs(targetX - this.x) < 900) {
        this.fireT = this.firePeriod;
        this.flashT = 0.12;
        // Ballistic shell aimed at Godzilla's current position.
        const T = 1.15, g = 900;
        this.shells.push({ x: this.x, h: 34, vx: (targetX - this.x) / T, vy: g * T / 2, g });
      }
    }
    for (const s of this.shells) {
      s.x += s.vx * dt;
      s.h += s.vy * dt;
      s.vy -= s.g * dt;
    }
  }

  draw(ctx, camX, groundY, time) {
    const sx = this.x - camX;
    const bobY = Math.sin(time * 1.6 + this.bob) * 3;
    const sink = this.state === 'sinking' ? this.sinkT * 60 : 0;
    const tilt = this.state === 'sinking' ? this.sinkT * 0.5 : 0;
    ctx.save();
    ctx.translate(sx, groundY + bobY + sink);
    ctx.rotate(tilt);
    ctx.globalAlpha = this.state === 'sinking' ? Math.max(0, 1 - this.sinkT / 0.9) : 1;
    // hull
    ctx.fillStyle = '#5b6570';
    ctx.beginPath();
    ctx.moveTo(-65, 0);
    ctx.lineTo(65, 0);
    ctx.lineTo(50, 22);
    ctx.lineTo(-50, 22);
    ctx.closePath();
    ctx.fill();
    // deckhouse + windows
    ctx.fillStyle = '#78838f';
    ctx.fillRect(-28, -22, 46, 22);
    ctx.fillStyle = '#39424c';
    ctx.fillRect(-20, -16, 10, 8);
    ctx.fillRect(-2, -16, 10, 8);
    // mast
    ctx.fillRect(8, -40, 3, 20);
    // turret + barrel (aimed up-left toward Godzilla)
    ctx.fillStyle = '#4a545e';
    ctx.fillRect(-52, -12, 22, 12);
    ctx.save();
    ctx.translate(-44, -10);
    ctx.rotate(-0.7);
    ctx.fillRect(-26, -3, 26, 6);
    if (this.flashT > 0) {
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(-28, 0, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
    // shells in flight
    for (const s of this.shells) {
      ctx.fillStyle = 'rgba(255,239,158,0.35)';
      ctx.beginPath();
      ctx.arc(s.x - camX - s.vx * 0.02, groundY - s.h + s.vy * 0.02, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffef9e';
      ctx.beginPath();
      ctx.arc(s.x - camX, groundY - s.h, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}