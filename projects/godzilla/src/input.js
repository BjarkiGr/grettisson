// Keyboard input: `down` for held keys, `hit` for just-pressed this frame.
class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    window.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }
  down(...ks) { return ks.some((k) => this.keys.has(k)); }
  hit(...ks) { return ks.some((k) => this.pressed.has(k)); }
  endFrame() { this.pressed.clear(); }
  // Synthetic key events from the touch buttons (src/touch.js), so touch
  // and keyboard feed the exact same held/just-pressed state.
  press(k) {
    if (!this.keys.has(k)) this.pressed.add(k);
    this.keys.add(k);
  }
  release(k) { this.keys.delete(k); }
}
