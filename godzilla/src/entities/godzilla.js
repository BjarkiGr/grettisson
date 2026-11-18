// The king of the monsters. States: idle / walking / attacking / roaring.
// update() returns events ({ hit, stepped }) that Game reacts to.
class Godzilla {
  constructor(x) {
    this.x = x;
    this.facing = 1;
    this.speed = 235;
    this.state = 'idle';
    this.walkPhase = 0;
    this.idleT = 0;
    this.stepT = 0.3;
    this.attackT = 0;
    this.attackDur = 0.45;
    this.hitTime = 0.2;
    this.hitDone = false;
    this.roarT = 0;
    this.roarDur = 0.8;
    this.roarCooldown = 0;
    this.halfW = 45;
    this.height = 245;
  }

  get busy() { return this.state === 'attacking' || this.state === 'roaring'; }

  startAttack() {
    if (this.busy) return false;
    this.state = 'attacking';
    this.attackT = 0;
    this.hitDone = false;
    return true;
  }

  startRoar() {
    if (this.busy || this.roarCooldown > 0) return false;
    this.state = 'roaring';
    this.roarT = 0;
    this.roarCooldown = 4;
    return true;
  }

  update(dt, move, buildings) {
    const events = { hit: false, stepped: false };
    this.roarCooldown = Math.max(0, this.roarCooldown - dt);
    this.idleT += dt;
    if (this.state === 'attacking') {
      this.attackT += dt;
      if (!this.hitDone && this.attackT >= this.hitTime) {
        this.hitDone = true;
        events.hit = true;
      }
      if (this.attackT >= this.attackDur) this.state = 'idle';
    } else if (this.state === 'roaring') {
      this.roarT += dt;
      if (this.roarT >= this.roarDur) this.state = 'idle';
    } else if (move !== 0) {
      this.facing = move > 0 ? 1 : -1;
      this.state = 'walking';
      let nx = this.x + move * this.speed * dt;
      // Solid buildings block movement; rubble is walkable.
      if (move > 0) {
        for (const b of buildings) {
          if (b.solid && b.left >= this.x - this.halfW) nx = Math.min(nx, b.left - this.halfW);
        }
      } else {
        for (const b of buildings) {
          if (b.solid && b.right <= this.x + this.halfW) nx = Math.max(nx, b.right + this.halfW);
        }
      }
      nx = Math.max(nx, 60);
      const moved = Math.abs(nx - this.x) > 0.01;
      this.x = nx;
      if (moved) {
        this.walkPhase += dt * 7;
        this.stepT += dt;
        if (this.stepT >= 0.42) { this.stepT = 0; events.stepped = true; }
      }
    } else {
      this.state = 'idle';
      this.stepT = 0.3;
    }
    return events;
  }

  attackRange() {
    return { from: this.x + this.facing * 10, to: this.x + this.facing * 165 };
  }

  draw(ctx, camX, groundY, time) {
    const sx = this.x - camX;
    const walking = this.state === 'walking';
    const ph = this.walkPhase;
    const bob = walking ? Math.abs(Math.sin(ph)) * 6 : Math.sin(this.idleT * 2) * 2.5;
    let lean = 0, swipe = 0, jaw = 0;
    if (this.state === 'attacking') {
      const p = this.attackT / this.attackDur;
      lean = Math.sin(p * Math.PI) * 0.15;
      swipe = Math.sin(p * Math.PI);
      jaw = swipe * 0.4;
    } else if (this.state === 'roaring') {
      const p = this.roarT / this.roarDur;
      lean = -Math.sin(p * Math.PI) * 0.1;
      jaw = Math.sin(p * Math.PI);
    }
    const BODY = '#3d4a4f', DARK = '#2c363b', BELLY = '#93a08a', PLATE = '#c9d4e0';
    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(sx, groundY + 6, 75, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(sx, groundY);
    ctx.scale(this.facing, 1);
    ctx.rotate(lean);
    ctx.translate(0, -bob);
    const legA = walking ? Math.sin(ph) * 0.45 : 0;
    const legB = walking ? Math.sin(ph + Math.PI) * 0.45 : 0;
    const sway = Math.sin(walking ? ph : this.idleT * 1.5) * 12;
    const leg = (hipX, angle, color) => {
      ctx.save();
      ctx.translate(hipX, -88);
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.fillRect(-15, 0, 30, 78);
      ctx.fillRect(-15, 66, 44, 16);
      ctx.fillStyle = '#d8d8d0';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(29, 70 + i * 5);
        ctx.lineTo(38, 72 + i * 5);
        ctx.lineTo(29, 75 + i * 5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    };
    leg(-14, legB, DARK); // far leg
    // tail
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.moveTo(-15, -145);
    ctx.quadraticCurveTo(-95, -115 + sway * 0.4, -175, -30 + sway);
    ctx.quadraticCurveTo(-100, -62 + sway * 0.4, -28, -62);
    ctx.closePath();
    ctx.fill();
    // tail plates
    ctx.fillStyle = PLATE;
    const tp = [[-70, -108 + sway * 0.25, 10], [-110, -80 + sway * 0.5, 8], [-140, -52 + sway * 0.75, 6]];
    for (const [px, py, s] of tp) {
      ctx.beginPath();
      ctx.moveTo(px - s, py + 4);
      ctx.lineTo(px, py - s * 1.5);
      ctx.lineTo(px + s, py + 4);
      ctx.closePath();
      ctx.fill();
    }
    // body + belly
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.ellipse(0, -140, 54, 78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = BELLY;
    ctx.beginPath();
    ctx.ellipse(16, -128, 30, 58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-4, -170 + i * 20);
      ctx.lineTo(40, -166 + i * 20);
      ctx.stroke();
    }
    leg(16, legA, BODY); // near leg
    // dorsal plates (glow while attacking)
    if (this.state === 'attacking') { ctx.shadowColor = '#7fe7ff'; ctx.shadowBlur = 16; }
    ctx.fillStyle = PLATE;
    const plates = [[-46, -168, 13], [-30, -192, 16], [-8, -208, 17], [14, -212, 13]];
    for (const [px, py, s] of plates) {
      ctx.beginPath();
      ctx.moveTo(px - s, py + 5);
      ctx.lineTo(px - 2, py - s * 1.5);
      ctx.lineTo(px + s, py + 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    // head + snout
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.moveTo(12, -196);
    ctx.quadraticCurveTo(24, -238, 48, -242);
    ctx.lineTo(84, -236);
    ctx.quadraticCurveTo(92, -232, 90, -224);
    ctx.lineTo(58, -220);
    ctx.lineTo(56, -206);
    ctx.quadraticCurveTo(34, -200, 20, -186);
    ctx.closePath();
    ctx.fill();
    // lower jaw (opens for attack / roar)
    ctx.save();
    ctx.translate(56, -220);
    ctx.rotate(jaw * 0.55);
    ctx.fillStyle = DARK;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(32, 2);
    ctx.lineTo(30, 10);
    ctx.lineTo(0, 9);
    ctx.closePath();
    ctx.fill();
    if (jaw > 0.15) { ctx.fillStyle = '#b03a2e'; ctx.fillRect(2, 1, 26, 4); }
    ctx.restore();
    // eye + brow
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(52, -232, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(53.5, -232, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = DARK;
    ctx.fillRect(44, -240, 18, 4);
    // far arm
    ctx.save();
    ctx.translate(14, -160);
    ctx.rotate(0.8);
    ctx.fillStyle = DARK;
    ctx.fillRect(0, -6, 38, 12);
    ctx.restore();
    // near arm (swipes forward during attack)
    ctx.save();
    ctx.translate(30, -168);
    ctx.rotate(0.6 - swipe * 1.8);
    ctx.fillStyle = BODY;
    ctx.fillRect(0, -7, 46, 14);
    ctx.fillStyle = '#d8d8d0';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(46, -6 + i * 6);
      ctx.lineTo(56, -4 + i * 6);
      ctx.lineTo(46, -1 + i * 6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }
}
