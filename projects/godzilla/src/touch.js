// Touch controls for phones/tablets: DOM buttons overlaid on the canvas.
// Each button injects synthetic key events into Input (press/release), so
// all gameplay code stays keyboard-driven and touch + keyboard mix freely.
// Only shown on coarse-pointer devices; desktop rendering is untouched.
class TouchUI {
  constructor(game) {
    this.game = game;
    game.touchUI = this;
    this.enabled = typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : 'ontouchstart' in window;
    this.lastSync = null;
    if (!this.enabled || typeof document.createElement !== 'function') return;
    this.root = document.createElement('div');
    this.root.id = 'touch-ui';
    document.body.appendChild(this.root);
    // gameplay buttons (key mappings mirror the keyboard)
    this.brake = this.button('BRAKE', 'arrowleft', 'brake');
    this.sprint = this.button('SPRINT', 'arrowright', 'sprint');
    this.smash = this.button('SMASH', ' ', 'smash');
    this.dive = this.button('DIVE', 'arrowdown', 'dive');
    this.jump = this.button('JUMP', 'arrowup', 'jump');
    this.beam = this.button('BEAM', 'f', 'beam');
    this.roar = this.button('ROAR', 'r', 'roar');
    this.playBtns = [this.brake, this.sprint, this.smash, this.dive, this.jump, this.beam, this.roar];
    // system buttons (below the mode panel)
    this.mute = this.button('🔊', 'm', 'sys mute');
    this.exit = this.button('✕', 'escape', 'sys exit');
    // menu buttons (title / results screens)
    this.menuRow = document.createElement('div');
    this.menuRow.className = 'touch-menu';
    this.root.appendChild(this.menuRow);
    this.menuDaily = this.button('DAILY RAMPAGE', 'enter', 'daily', this.menuRow);
    this.menuCopy = this.button('COPY RESULT', 'c', 'copy', this.menuRow);
    this.menuUnlimited = this.button('UNLIMITED', 'u', 'unlimited', this.menuRow);
    this.menuTitle = this.button('TITLE', 'escape', 'title', this.menuRow);
  }

  button(text, key, cls, parent) {
    const el = document.createElement('button');
    el.className = 'touch-btn ' + cls;
    el.textContent = text;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      // keep receiving pointerup even if the finger slides off the button
      if (e.pointerId !== undefined && el.setPointerCapture) {
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* not critical */ }
      }
      this.game.sfx.unlock(); // audio unlock must happen inside the gesture (iOS)
      this.game.input.press(key);
      el.classList.add('held');
    });
    const release = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      this.game.input.release(key);
      el.classList.remove('held');
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
    (parent || this.root).appendChild(el);
    return el;
  }

  // Called once per frame: show/hide buttons for the current screen and
  // swap SMASH/JUMP for DIVE/UP while swimming. Cheap no-op when unchanged.
  sync() {
    if (!this.root) return;
    const g = this.game;
    const playing = g.state === 'playing';
    const title = g.state === 'title';
    const results = g.state === 'results';
    const inWater = playing && g.world.isWater(g.godzilla.x);
    const played = title ? Daily.playedToday() : false;
    const sig = g.state + '|' + inWater + '|' + g.sfx.muted + '|' + played;
    if (sig === this.lastSync) return;
    this.lastSync = sig;
    const show = (el, on) => { el.style.display = on ? '' : 'none'; };
    for (const el of this.playBtns) show(el, playing);
    show(this.smash, playing && !inWater);
    show(this.dive, playing && inWater);
    this.jump.textContent = inWater ? 'UP' : 'JUMP';
    show(this.mute, playing);
    show(this.exit, playing);
    this.mute.textContent = g.sfx.muted ? '🔇' : '🔊';
    show(this.menuRow, title || results);
    show(this.menuDaily, title);
    this.menuDaily.textContent = played ? 'VIEW RESULT' : 'DAILY RAMPAGE';
    show(this.menuCopy, results);
    show(this.menuUnlimited, title || results);
    show(this.menuTitle, results);
    // never leave gameplay keys held across a screen change
    if (!playing) {
      for (const k of ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'f', 'r']) {
        g.input.release(k);
      }
    }
  }
}