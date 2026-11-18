// The scrolling city: spawns buildings ahead of the camera, culls behind,
// and draws the dusk sky, parallax skylines, clouds and the road.
class World {
  constructor() {
    this.buildings = [];
    this.nextX = 760;
  }

  reset() {
    this.buildings = [];
    this.nextX = 760;
  }

  update(camX, viewW) {
    while (this.nextX < camX + viewW + 700) {
      const b = new Building(this.nextX);
      this.buildings.push(b);
      this.nextX += b.w + rand(60, 180);
    }
    this.buildings = this.buildings.filter((b) => b.right > camX - 500);
  }

  draw(ctx, camX, w, h, groundY, time) {
    // dusk sky
    const sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, '#1a1f3d');
    sky.addColorStop(0.55, '#4a2c52');
    sky.addColorStop(1, '#c96b3f');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, groundY);
    // moon
    ctx.fillStyle = '#f4e9c8';
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.16, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,170,140,0.5)';
    ctx.beginPath();
    ctx.arc(w * 0.78 - 10, h * 0.16 - 6, 6, 0, Math.PI * 2);
    ctx.arc(w * 0.78 + 9, h * 0.16 + 10, 4, 0, Math.PI * 2);
    ctx.fill();
    // parallax layers
    this.drawClouds(ctx, camX * 0.12 + time * 8, w, h);
    this.drawSkyline(ctx, camX * 0.25, w, groundY, 0.55, '#2b2440', 220, 41);
    this.drawSkyline(ctx, camX * 0.5, w, groundY, 0.75, '#241f33', 300, 97);
    // road
    ctx.fillStyle = '#2a2d33';
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.fillStyle = '#3a3e46';
    ctx.fillRect(0, groundY, w, 10);
    // lane dashes scroll with the camera
    ctx.fillStyle = '#c9b458';
    const dashY = groundY + (h - groundY) * 0.55;
    const off = -(camX % 90);
    for (let x = off; x < w; x += 90) ctx.fillRect(x, dashY, 46, 5);
  }

  drawSkyline(ctx, scroll, w, groundY, hFac, color, maxH, seed) {
    const bw = 70;
    const start = Math.floor(scroll / bw);
    for (let i = start - 1; i < start + w / bw + 2; i++) {
      const bh = (60 + hash1(i * 3.7 + seed) * maxH) * hFac;
      const x = i * bw - scroll;
      const bwid = bw - 6 - hash1(i + seed) * 14;
      ctx.fillStyle = color;
      ctx.fillRect(x, groundY - bh, bwid, bh);
      if (hash1(i * 7.3 + seed) > 0.5) {
        ctx.fillStyle = 'rgba(255,217,122,0.18)';
        for (let k = 0; k < 3; k++) {
          ctx.fillRect(
            x + 8 + hash1(i + k * 13 + seed) * (bwid - 16),
            groundY - bh + 10 + hash1(i * 2 + k + seed) * (bh - 20),
            4, 5
          );
        }
      }
    }
  }

  drawClouds(ctx, scroll, w, h) {
    ctx.fillStyle = 'rgba(240,220,220,0.14)';
    const span = 340;
    const start = Math.floor(scroll / span);
    for (let i = start - 1; i < start + w / span + 2; i++) {
      const cx = i * span - scroll + hash1(i * 1.3) * 160;
      const cy = 40 + hash1(i * 2.1) * h * 0.3;
      const s = 30 + hash1(i * 5.7) * 30;
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 2.2, s * 0.7, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + s, cy - s * 0.4, s * 1.4, s * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
