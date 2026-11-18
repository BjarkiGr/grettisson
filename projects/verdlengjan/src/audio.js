// All sound effects synthesized with Web Audio - no asset files.
// Same approach as projects/godzilla/src/audio.js.
class Sfx {
  constructor() { this.ctx = null; this.master = null; this.enabled = true; this.muted = false; }
  // Must be called from a user gesture (first bake / button press).
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.35;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }
  tone(f0, f1, dur, type, vol, delay = 0) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  ding() { this.tone(1046, 1046, 0.14, 'sine', 0.3); this.tone(1568, 1568, 0.3, 'sine', 0.22, 0.09); } // oven bell
  puff() { this.tone(300, 120, 0.18, 'triangle', 0.15); }
  sad() { this.tone(220, 90, 0.4, 'sawtooth', 0.12); }
  fanfare() {
    this.tone(523, 523, 0.12, 'square', 0.14);
    this.tone(659, 659, 0.12, 'square', 0.14, 0.12);
    this.tone(784, 784, 0.12, 'square', 0.14, 0.24);
    this.tone(1046, 1046, 0.35, 'square', 0.16, 0.36);
  }
}
