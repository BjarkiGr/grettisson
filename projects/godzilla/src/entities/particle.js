// Lightweight particle system: debris rects, dust circles, text popups,
// water splashes, bubbles and beam sparks. All randomness here is cosmetic
// (crand/cpick), so it never disturbs the seeded daily gameplay stream.
class Particles {
  constructor() { this.list = []; }

  debris(x, y, n, colors) {
    for (let i = 0; i < n; i++) {
      const life = crand(0.7, 1.5);
      this.list.push({
        type: 'rect',
        x: x + crand(-20, 20), y: y + crand(-20, 20),
        vx: crand(-260, 260), vy: crand(-460, -60),
        w: crand(4, 13), h: crand(4, 13),
        rot: crand(0, Math.PI * 2), vr: crand(-8, 8),
        life, max: life, color: cpick(colors), bounced: false,
      });
    }
  }

  dust(x, y, n) {
    for (let i = 0; i < n; i++) {
      const life = crand(0.7, 1.4);
      this.list.push({
        type: 'dust',
        x: x + crand(-15, 15), y: y + crand(-10, 10),
        vx: crand(-70, 70), vy: crand(-100, -15),
        r: crand(8, 22), growth: crand(25, 60),
        life, max: life, shade: crandInt(120, 170),
      });
    }
  }

  splash(x, y, n) {
    for (let i = 0; i < n; i++) {
      const life = crand(0.5, 1.0);
      this.list.push({
        type: 'rect',
        x: x + crand(-25, 25), y: y + crand(-6, 4),
        vx: crand(-220, 220), vy: crand(-520, -120),
        w: crand(3, 8), h: crand(3, 8),
        rot: crand(0, Math.PI * 2), vr: crand(-6, 6),
        life, max: life, color: cpick(['#bfe3ff', '#8fc6f0', '#e8f6ff']), bounced: true,
      });
    }
  }

  bubbles(x, y, n) {
    for (let i = 0; i < n; i++) {
      const life = crand(0.6, 1.4);
      this.list.push({
        type: 'bubble',
        x: x + crand(-20, 20), y: y + crand(-10, 10),
        vx: crand(-15, 15), vy: crand(-90, -40),
        r: crand(2, 6), life, max: life,
      });
    }
  }

  sparks(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const life = crand(0.2, 0.5);
      this.list.push({
        type: 'rect',
        x, y,
        vx: crand(-320, 320), vy: crand(-320, 80),
        w: crand(2, 5), h: crand(2, 5),
        rot: crand(0, Math.PI * 2), vr: crand(-10, 10),
        life, max: life, color, bounced: true,
      });
    }
  }

  popup(x, y, text, color, size = 22) {
    this.list.push({ type: 'text', x, y, vx: 0, vy: -70, life: 1.1, max: 1.1, text, color, size });
  }

  update(dt, groundY) {
    for (const p of this.list) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'rect') {
        p.vy += 1500 * dt;
        p.rot += p.vr * dt;
        if (p.y > groundY - p.h / 2 && p.vy > 0) {
          if (!p.bounced) { p.vy *= -0.35; p.vx *= 0.6; p.bounced = true; }
          else { p.y = groundY - p.h / 2; p.vy = 0; p.vx *= 0.9; }
        }
      } else if (p.type === 'dust') {
        p.r += p.growth * dt;
        p.vy *= Math.max(0, 1 - 1.5 * dt);
      }
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  draw(ctx, camX) {
    for (const p of this.list) {
      const a = clamp(p.life / p.max, 0, 1);
      const sx = p.x - camX;
      if (p.type === 'rect') {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(sx, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      } else if (p.type === 'dust') {
        ctx.globalAlpha = a * 0.45;
        ctx.fillStyle = 'rgb(' + p.shade + ',' + (p.shade - 8) + ',' + (p.shade - 18) + ')';
        ctx.beginPath();
        ctx.arc(sx, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.type === 'bubble') {
        ctx.globalAlpha = a * 0.6;
        ctx.strokeStyle = '#bfe3ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.font = 'bold ' + p.size + 'px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, sx, p.y);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
      }
    }
  }
}