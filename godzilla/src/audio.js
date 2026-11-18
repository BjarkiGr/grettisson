// All sound effects are synthesized with Web Audio - no asset files.
class Sfx {
  constructor() {
    this.ctx = null; this.master = null; this.noiseBuf = null;
    this.enabled = true; this.muted = false;
  }
  // Must be called from a user gesture (ENTER on the title screen).
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.4;
    return this.muted;
  }
  tone(f0, f1, dur, type, vol) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
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
  noise(dur, freq, vol, type = 'lowpass', q = 0.8) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.05);
  }
  stomp() { this.tone(85, 38, 0.16, 'sine', 0.7); this.noise(0.07, 260, 0.18); }
  whoosh() { this.noise(0.14, 900, 0.15, 'bandpass', 1.5); }
  hit() { this.noise(0.12, 1100, 0.45, 'bandpass', 1); this.tone(170, 55, 0.12, 'square', 0.22); }
  crumble() {
    this.noise(0.75, 420, 0.6);
    this.noise(0.4, 1500, 0.2, 'highpass');
    this.tone(110, 28, 0.55, 'sine', 0.55);
  }
  roar() {
    this.tone(150, 95, 0.9, 'sawtooth', 0.35);
    this.tone(220, 130, 0.9, 'sawtooth', 0.25);
    this.tone(75, 45, 0.9, 'square', 0.2);
    this.noise(0.9, 700, 0.2, 'bandpass', 2);
  }
}
