// The vínarbrauðslengja: ONE seamless 16-bit pixel-art pastry that grows by
// the exact number of cm each answer earns. The whole loaf is a single SVG
// sprite on a 4px pixel grid (8px per cm). The ruler is a fixed 0-100 cm
// scale: the loaf fills its share of the band - no scrolling, no zooming.
// Look: identical cross-section along the whole length - chocolate + pink
// frosting on top, a yellow custard line in the middle, toasted almonds on
// the brown crust below.
// All randomness here is cosmetic (hash1/crand) - never the seeded stream.
const Lengja = {
  PX_PER_CM: 8,
  P: 4,              // pixel size
  H: 64,             // 16 pixel rows
  MAX_CM: 100,       // fixed ruler scale: 0-100 cm, 100 = completely full
  BAND_H: 110,       // loaf display height in px (big at any length)
  scroller: null, strip: null, ruler: null,
  totalCm: 0, loafW: 0, loafH: 0,
  reduced: false,
  PAL: {
    O: '#2a1608', // outline (deep bake)
    H: '#f8e0a0', // top highlight
    L: '#f0c060', // light crust
    M: '#d89030', // mid crust
    D: '#a06028', // dark crust
    C: '#f8d848', // vanilla custard line
    c: '#d8a820', // custard shadow
    K: '#5a3018', // chocolate frosting
    k: '#7a4828', // chocolate highlight
    P: '#f088b8', // pink frosting
    p: '#d06898', // pink shadow
    A: '#e8c890', // toasted almond
    a: '#b8863c', // almond toast
    S: 'rgba(0,0,0,0.35)', // ground shadow
  },

  init(scrollerEl, stripEl, rulerEl) {
    this.scroller = scrollerEl; this.strip = stripEl; this.ruler = rulerEl;
    this.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.addEventListener('resize', () => this.render(false));
    this.reset();
  },

  reset() {
    this.totalCm = 0;
    this.addSlice(START_CM, 'endi', false); // endinn á lengjunni
  },

  addSlice(cm, tierId, animate) {
    if (cm <= 0) return; // more than 100% off: the lengja does not grow
    this.totalCm += cm;
    this.render(animate && !this.reduced);
    if (animate && !this.reduced) {
      this.steam();
      if (tierId === 'exact') this.sparkle();
    }
  },

  // Fixed 0-100 cm scale: the loaf fills its share of the band, no scrolling.
  layout() {
    const W = (this.scroller && this.scroller.clientWidth) || 520;
    const scale = W / (this.MAX_CM * this.PX_PER_CM);
    const shownCm = Math.min(this.totalCm, this.MAX_CM);
    return {
      scale,
      loafW: shownCm * this.PX_PER_CM * scale,
      loafH: this.BAND_H,
    };
  },

  render(animate) {
    const L = this.layout();
    this.loafW = L.loafW; this.loafH = L.loafH;
    this.strip.innerHTML = this.svg(L.loafW, L.loafH);
    const sv = this.strip.firstElementChild;
    if (animate && sv && sv.classList) sv.classList.add('baking');
    this.buildRuler(L);
  },

  buildRuler(L) {
    const r = this.ruler;
    r.innerHTML = '';
    r.style.width = (this.MAX_CM * this.PX_PER_CM * L.scale) + 'px';
    for (let cm = 0; cm <= this.MAX_CM; cm += 5) {
      const major = cm % 10 === 0;
      const tick = document.createElement('div');
      tick.className = 'tick' + (major ? ' major' : '');
      tick.style.left = (cm * this.PX_PER_CM * L.scale) + 'px';
      r.appendChild(tick);
      if (major) {
        const lab = document.createElement('span');
        lab.className = 'tick-label';
        lab.style.left = (cm * this.PX_PER_CM * L.scale) + 'px';
        lab.textContent = cm;
        r.appendChild(lab);
      }
    }
  },

  steam() {
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.className = 'steam';
      s.style.left = Math.max(4, this.loafW - 30 + crand(-14, 14)) + 'px';
      s.style.bottom = (this.loafH - 8) + 'px';
      s.style.animationDelay = (i * 0.15) + 's';
      this.strip.appendChild(s);
      s.addEventListener('animationend', () => s.remove());
    }
  },

  sparkle() {
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.className = 'sparkle';
      s.textContent = '✨';
      s.style.left = Math.max(4, this.loafW - 46 + i * 16) + 'px';
      s.style.bottom = (this.loafH + 2) + 'px';
      s.style.animationDelay = (i * 0.12) + 's';
      this.strip.appendChild(s);
      s.addEventListener('animationend', () => s.remove());
    }
  },

  // The whole loaf as one 16-row pixel grid of palette keys ('.' = empty).
  sprite(cols) {
    const rows = 16;
    const g = [];
    for (let y = 0; y < rows; y++) g.push(new Array(cols).fill('.'));
    const set = (x, y, c) => { if (x >= 0 && x < cols && y >= 0 && y < rows) g[y][x] = c; };
    // ground shadow
    for (let x = 2; x < cols - 2; x++) set(x, 15, 'S');
    // outline, with skipped corner pixels for a rounded 16-bit look
    for (let x = 1; x < cols - 1; x++) { set(x, 4, 'O'); set(x, 14, 'O'); }
    for (let y = 5; y <= 13; y++) { set(0, y, 'O'); set(cols - 1, y, 'O'); }
    // crust body with the yellow vanilla line running down the center
    for (let y = 5; y <= 13; y++) {
      for (let x = 1; x < cols - 1; x++) {
        let c;
        if (y === 5) c = 'H';
        else if (y <= 8) c = y <= 6 ? 'L' : 'M';
        else if (y === 9) c = 'C';
        else if (y === 10) c = 'c';
        else c = y <= 12 ? 'M' : 'D';
        set(x, y, c);
      }
    }
    // flaky layer dashes
    for (let x = 1; x < cols - 1; x++) if (x % 4 === 1 || x % 4 === 2) set(x, 12, 'D');
    // darker baked crust on both ends of the loaf
    for (let y = 5; y <= 13; y++) {
      if (y !== 9 && y !== 10) { set(1, y, 'D'); set(cols - 2, y, 'D'); }
    }
    // chocolate frosting with a pink zigzag drizzle along the WHOLE top
    for (let x = 1; x < cols - 1; x++) {
      set(x, 5, 'k'); set(x, 6, 'K'); set(x, 7, 'K');
      const py = 5 + (Math.floor(x / 2) % 2);
      set(x, py, 'P'); set(x, py + 1, 'p');
      if (hash1(x * 3.7) < 0.18) set(x, 8, 'K'); // chocolate drip
    }
    // toasted almond flakes on the brown crust along the WHOLE bottom
    const span = cols - 2;
    if (span > 0) {
      const n = Math.max(2, Math.floor(span / 2));
      for (let i = 0; i < n; i++) {
        const x = 1 + Math.floor(hash1(i * 3.1 + cols) * span);
        const y = 11 + Math.floor(hash1(i * 7.7 + cols) * 2);
        set(x, y, 'A'); set(x, y + 1, 'a');
      }
    }
    return g;
  },

  // Run-length encode each pixel row into crisp SVG rects (one per color run).
  svg(w, h) {
    const cols = Math.max(Math.min(this.totalCm, this.MAX_CM) * (this.PX_PER_CM / this.P), 4);
    const g = this.sprite(cols);
    let s = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + (cols * this.P) + ' ' + this.H + '" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" shape-rendering="crispEdges">';
    for (let y = 0; y < g.length; y++) {
      let x = 0;
      while (x < cols) {
        const c = g[y][x];
        if (c === '.') { x++; continue; }
        let run = 1;
        while (x + run < cols && g[y][x + run] === c) run++;
        s += '<rect x="' + (x * this.P) + '" y="' + (y * this.P) + '" width="' + (run * this.P) + '" height="' + this.P + '" fill="' + this.PAL[c] + '"/>';
        x += run;
      }
    }
    return s + '</svg>';
  },
};