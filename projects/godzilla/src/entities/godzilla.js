// The king of the monsters. Auto-walks forward; brake/sprint modify speed.
// States: idle / walking / jumping / attacking / roaring / swimming.
// The atomic beam is a flag (beamOn) so it can combine with walking/swimming.
// update() returns events ({ hit, stepped, landed, slam, waterChanged }).
class Godzilla {
  constructor(x) {
    this.x = x;
    this.facing = 1;
    this.speed = 235;
    this.swimSpeed = 170;
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
    // jump physics: y = height above ground, vy positive up
    this.y = 0;
    this.vy = 0;
    this.slam = false;
    // swim: how far below the surface (0 = cruising, 140 = fully submerged)
    this.swimDepth = 0;
    this.wasInWater = false;
    // atomic beam
    this.energy = 100;
    this.beamOn = false;
    this.stunT = 0;
  }

  get busy() { return this.state === 'attacking' || this.state === 'roaring'; }
  get airborne() { return this.y > 0 || this.vy !== 0; }

  startAttack() {
    if (this.busy || this.state === 'swimming') return false; // no swipe in water
    if (this.airborne) { // body slam: fast fall, big landing shockwave
      this.slam = true;
      this.vy = -1100;
      return true;
    }
    this.state = 'attacking';
    this.attackT = 0;
    this.hitDone = false;
    return true;
  }

  startJump() {
    if (this.busy || this.airborne || this.state === 'swimming') return false;
    this.vy = 780;
    this.y = 0.01;
    this.state = 'jumping';
    this.beamOn = false;
    return true;
  }

  startRoar() {
    if (this.busy || this.roarCooldown > 0) return false;
    this.state = 'roaring';
    this.roarT = 0;
    this.roarCooldown = 4;
    return true;
  }

  setBeam(on) {
    const canFire = !this.busy && !this.airborne && this.stunT <= 0 &&
      (this.state !== 'swimming' || this.swimDepth < 60) &&
      this.energy > (this.beamOn ? 0 : 8);
    this.beamOn = !!(on && canFire);
  }

  stun(t) {
    this.stunT = Math.max(this.stunT, t);
    this.beamOn = false;
  }

  // World-space mouth position (beam origin). Matches the draw transform.
  mouthPos(groundY) {
    const sink = this.state === 'swimming' ? 150 + this.swimDepth : 0;
    return { x: this.x + this.facing * 88, y: groundY - this.y + sink - 222 };
  }

  update(dt, move, buildings, inWater, depthMove) {
    const events = { hit: false, stepped: false, landed: false, slam: false, waterChanged: false };
    this.roarCooldown = Math.max(0, this.roarCooldown - dt);
    this.stunT = Math.max(0, this.stunT - dt);
    this.idleT += dt;
    // beam energy: drains while firing, slow regen otherwise
    if (this.beamOn) {
      this.energy -= 26 * dt;
      if (this.energy <= 0) { this.energy = 0; this.beamOn = false; }
    } else {
      this.energy = Math.min(100, this.energy + 7 * dt);
    }
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
    } else if (inWater) {
      // swim: auto-forward, up/down controls depth, no swipe (beam only)
      this.state = 'swimming';
      this.y = 0;
      this.vy = 0;
      this.facing = 1;
      this.swimDepth = clamp(this.swimDepth + (depthMove || 0) * 170 * dt, 0, 140);
      const sp = this.stunT > 0 ? 0 : this.swimSpeed * move * (this.beamOn ? 0.4 : 1);
      this.x += sp * dt;
      this.walkPhase += dt * 4;
    } else {
      this.swimDepth = 0;
      if (this.airborne) {
        this.state = 'jumping';
        this.vy -= 1500 * dt;
        this.y += this.vy * dt;
        let nx = this.x + (this.stunT > 0 ? 0 : this.speed * move) * dt;
        // only buildings taller than the current jump height block
        for (const b of buildings) {
          if (b.solid && b.h > this.y && b.left >= this.x - this.halfW) nx = Math.min(nx, b.left - this.halfW);
        }
        this.x = Math.max(nx, 60);
        if (this.y <= 0) {
          this.y = 0;
          this.vy = 0;
          this.state = 'idle';
          events.landed = true;
          events.slam = this.slam;
          this.slam = false;
        }
      } else if (move > 0 && this.stunT <= 0) {
        this.facing = 1;
        this.state = 'walking';
        let nx = this.x + this.speed * move * (this.beamOn ? 0.35 : 1) * dt;
        // Solid buildings block movement; rubble is walkable.
        for (const b of buildings) {
          if (b.solid && b.left >= this.x - this.halfW) nx = Math.min(nx, b.left - this.halfW);
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
    }
    if (inWater !== this.wasInWater) {
      events.waterChanged = true;
      this.wasInWater = inWater;
    }
    return events;
  }

  attackRange() {
    return { from: this.x + this.facing * 10, to: this.x + this.facing * 165 };
  }

  draw(ctx, camX, groundY, time) {
    const sx = this.x - camX;
    const swimming = this.state === 'swimming';
    const walking = this.state === 'walking';
    const jumping = this.state === 'jumping';
    const sink = swimming ? 150 + this.swimDepth : 0;
    const ph = this.walkPhase;
    const bob = swimming ? Math.sin(this.idleT * 3) * 4
      : walking ? Math.abs(Math.sin(ph)) * 6 : Math.sin(this.idleT * 2) * 2.5;
    let lean = swimming ? 0.16 : jumping ? 0.08 : 0, swipe = 0, jaw = 0;
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
    if (this.beamOn) jaw = Math.max(jaw, 0.8 + Math.sin(time * 30) * 0.05);
    const BODY = '#3d4a4f', DARK = '#2c363b', BELLY = '#93a08a', PLATE = '#c9d4e0';
    // ground shadow (skip in water, shrink while airborne)
    if (!swimming) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(sx, groundY + 6, 75 * clamp(1 - this.y / 500, 0.4, 1), 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    if (this.stunT > 0 && Math.sin(time * 40) > 0) ctx.globalAlpha = 0.55;
    ctx.translate(sx, groundY - this.y + sink);
    ctx.scale(this.facing, 1);
    ctx.rotate(lean);
    ctx.translate(0, -bob);
    const legA = swimming ? Math.sin(ph) * 0.15 : jumping ? 0.5 : walking ? Math.sin(ph) * 0.45 : 0;
    const legB = swimming ? Math.sin(ph + Math.PI) * 0.15 : jumping ? -0.3 : walking ? Math.sin(ph + Math.PI) * 0.45 : 0;
    const sway = Math.sin(swimming ? this.idleT * 3 : walking ? ph : this.idleT * 1.5) * (swimming ? 20 : 12);
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
    // dorsal plates (pink glow while beaming, blue while attacking)
    if (this.beamOn) { ctx.shadowColor = '#ff5fa2'; ctx.shadowBlur = 22; }
    else if (this.state === 'attacking') { ctx.shadowColor = '#7fe7ff'; ctx.shadowBlur = 16; }
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
    // lower jaw (opens for attack / roar / beam)
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
    if (jaw > 0.15) { ctx.fillStyle = this.beamOn ? '#ff5fa2' : '#b03a2e'; ctx.fillRect(2, 1, 26, 4); }
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
    // near arm (swipes forward during attack, tucked while swimming)
    ctx.save();
    ctx.translate(30, -168);
    ctx.rotate(swimming ? 1.1 : 0.6 - swipe * 1.8);
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