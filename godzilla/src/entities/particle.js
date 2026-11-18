// Lightweight particle system: debris rects, dust circles, text popups.
class Particles {
  constructor() { this.list = []; }

  debris(x, y, n, colors) {
    for (let i = 0; i < n; i++) {
      const life = rand(0.7, 1.5);
      this.list.push({
        type: 'rect',
        x: x + rand(-20, 20), y: y + rand(-20, 20),
        vx: rand(-260, 260), vy: rand(-460, -60),
        w: rand(4, 13), h: rand(4, 13),
        rot: rand(0, Math.PI * 2), vr: rand(-8, 8),
        life, max: life, color: pick(colors), bounced: false,
      });
    }
  }

  dust(x, y, n) {
    for (let i = 0; i < n; i++) {
      const life = rand(0.7, 1.4);
      this.list.push({
        type: 'dust',
        x: x + rand(-15, 15), y: y + rand(-10, 10),
        vx: rand(-70, 70), vy: rand(-100, -15),
        r: rand(8, 22), growth: rand(25, 60),
        life, max: life, shade: randInt(120, 170),
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
