// Entry point: fullscreen canvas + fixed requestAnimationFrame loop
// with clamped delta-time so speed is framerate-independent.
const canvas = document.getElementById('game');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const game = new Game(canvas);

let last = performance.now();
function loop(t) {
  const dt = Math.min((t - last) / 1000, 0.05);
  last = t;
  game.update(dt);
  game.input.endFrame();
  game.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
