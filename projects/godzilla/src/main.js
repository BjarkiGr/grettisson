// Entry point: fullscreen canvas + fixed requestAnimationFrame loop
// with clamped delta-time so speed is framerate-independent.
const canvas = document.getElementById('game');

function resize() {
  // Backing store at device resolution (capped at 2) for crisp rendering;
  // CSS size stays viewport-sized. Game converts via canvas.dpr.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.dpr = dpr;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

const game = new Game(canvas);
const touch = new TouchUI(game);
touch.sync();

let last = performance.now();
function loop(t) {
  const dt = Math.min((t - last) / 1000, 0.05);
  last = t;
  game.update(dt);
  game.input.endFrame();
  game.draw();
  touch.sync();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
