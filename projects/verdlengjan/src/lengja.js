// The vínarbrauðslengja: a 16-bit pixel-art pastry strip that grows by the
// exact number of cm each answer earns. Each slice is a sprite drawn on a
// 4px pixel grid (8px per cm, so widths always align), rendered as SVG rects
// with crispEdges - no gradients, no anti-aliasing, chunky SNES-era palette.
// All randomness here is cosmetic (hash1/crand) - never the seeded stream.
const Lengja = {
  PX_PER_CM: 8,
  P: 4,          // pixel size
  H: 64,         // 16 pixel rows
  MAX_CM: 110,   // ruler scale: 2 start + 5x20 + 5 thursday = 107 max
  scroller: null, strip: null, ruler: null,
  totalCm: 0,
  reduced: false,
  PAL: {
    O: '#4a2c12', // outline
    H: '#f8e0a0', // top highlight
    L: '#f0c060', // light crust
    M: '#d89030', // mid crust
    D: '#a06028', // dark crust
    G: '#f8d878', // golden body (exact hit)
    g: '#e8b830', // golden shadow
    J: '#c02828', // jam
    j: '#e85040', // jam shine
    I: '#f8f8f0', // icing
    i: '#d8d0c0', // icing shadow
    A: '#f0e0b0', // almond
    a: '#c8b080', // almond shadow
    R: '#503060', // raisin
    r: '#8060a0', // raisin shine
    F: '#e03030', // flag
    S: 'rgba(74,44,18,0.25)', // ground shadow
  },

  init(scrollerEl, stripEl, rulerEl) {
    this.scroller = scrollerEl; this.strip = stripEl; this.ruler = rulerEl;
    this.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.buildRuler();
    this.reset();
  },

  reset() {
    this.strip.innerHTML = '';
    this.totalCm = 0;
    this.addSlice(START_CM, 'endi', false); // endinn á lengjunni
  },

  buildRuler() {
    const r = this.ruler;
    r.innerHTML = '';
    r.style.width = (this.MAX_CM * this.PX_PER_CM) + 'px';
    for (let cm = 0; cm <= this.MAX_CM; cm += 5) {
      const major = cm % 10 === 0;
      const tick = document.createElement('div');
      tick.className = 'tick' + (major ? ' major' : '');
      tick.style.left = (cm * this.PX_PER_CM) + 'px';
      r.appendChild(tick);
      if (major) {
        const lab = document.createElement('span');
        lab.className = 'tick-label';
        lab.style.left = (cm * this.PX_PER_CM) + 'px';
        lab.textContent = cm;
        r.appendChild(lab);
      }
    }
    const marks = [[30, '🚩', 'heil lengja'], [60, '🚩', 'bakkablöð'], [100, '🏆', 'Metralengjan']];
    for (const [cm, icon, label] of marks) {
      const m = document.createElement('div');
      m.className = 'milestone';
      m.style.left = (cm * this.PX_PER_CM) + 'px';
      m.innerHTML = '<span class="m-icon">' + icon + '</span><span class="m-label">' + label + '</span>';
      r.appendChild(m);
    }
  },

  addSlice(cm, tierId, animate) {
    if (cm <= 0) return null; // more than 100% off: the lengja does not grow
    const w = cm * this.PX_PER_CM;
    const wrap = document.createElement('div');
    wrap.className = 'slice' + (animate && !this.reduced ? ' baking' : '');
    wrap.style.width = w + 'px';
    wrap.innerHTML = this.svg(w, tierId);
    this.strip.appendChild(wrap);
    this.totalCm += cm;
    if (animate && !this.reduced) {
      this.steam(wrap);
      if (tierId === 'exact') this.sparkle(wrap);
    }
    if (this.scroller) this.scroller.scrollLeft = this.scroller.scrollWidth;
    return wrap;
  },

  steam(wrap) {
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.className = 'steam';
      s.style.left = (30 + crand(-18, 18)) + '%';
      s.style.animationDelay = (i * 0.15) + 's';
      wrap.appendChild(s);
      s.addEventListener('animationend', () => s.remove());
    }
  },

  sparkle(wrap) {
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.className = 'sparkle';
      s.textContent = '✨';
      s.style.left = (20 + i * 25) + '%';
      s.style.animationDelay = (i * 0.12) + 's';
      wrap.appendChild(s);
      s.addEventListener('animationend', () => s.remove());
    }
  },

  // Build the slice sprite as a 16-row pixel grid of palette keys ('.' = empty).
  sprite(cols, tierId) {
    const rows = 16;
    const g = [];
    for (let y = 0; y < rows; y++) g.push(new Array(cols).fill('.'));
    const exact = tierId === 'exact';
    const set = (x, y, c) => { if (x >= 0 && x < cols && y >= 0 && y < rows) g[y][x] = c; };
    // ground shadow
    for (let x = 2; x < cols - 2; x++) set(x, 15, 'S');
    // outline, with skipped corner pixels for a rounded 16-bit look
    for (let x = 1; x < cols - 1; x++) { set(x, 4, 'O'); set(x, 14, 'O'); }
    for (let y = 5; y <= 13; y++) { set(0, y, 'O'); set(cols - 1, y, 'O'); }
    // crust body: highlight top, light/mid/dark bands below
    for (let y = 5; y <= 13; y++) {
      for (let x = 1; x < cols - 1; x++) {
        let c;
        if (y === 5) c = 'H';
        else if (exact) c = y <= 11 ? 'G' : 'g';
        else c = y <= 7 ? 'L' : y <= 11 ? 'M' : 'D';
        set(x, y, c);
      }
    }
    // flaky layer dashes
    for (const y of [8, 11]) {
      for (let x = 1; x < cols - 1; x++) if (x % 4 === 1 || x % 4 === 2) set(x, y, exact ? 'g' : 'D');
    }
    // endinn: darker baked crust on the left edge
    if (tierId === 'endi') {
      for (let y = 5; y <= 13; y++) for (let x = 1; x <= Math.min(2, cols - 2); x++) set(x, y, 'D');
    }
    // jam stripe
    if (['decent', 'near', 'close', 'exact', 'thursday'].includes(tierId)) {
      for (let x = 1; x < cols - 1; x++) { set(x, 9, x % 3 === 0 ? 'j' : 'J'); set(x, 10, 'J'); }
    }
    // almond flakes
    if (['near', 'close', 'exact'].includes(tierId)) {
      const n = Math.max(2, Math.floor(cols / 4));
      for (let i = 0; i < n; i++) {
        const x = 1 + Math.floor(hash1(i * 3.1 + cols) * (cols - 2));
        const y = 6 + Math.floor(hash1(i * 7.7 + cols) * 6);
        set(x, y, 'A'); set(x, y + 1, 'a');
      }
    }
    // icing zigzag with a drip shadow
    if (['close', 'exact'].includes(tierId)) {
      for (let x = 1; x < cols - 1; x++) {
        const y = 5 + (Math.floor(x / 2) % 2);
        set(x, y, 'I'); set(x, y + 1, 'i');
      }
    }
    // the raisin on exact hits
    if (exact && cols >= 4) {
      const cx = Math.floor(cols / 2);
      set(cx - 1, 7, 'r'); set(cx, 7, 'R'); set(cx - 1, 8, 'R'); set(cx, 8, 'R');
    }
    // thursday flag on a pole
    if (tierId === 'thursday') {
      const cx = Math.floor(cols / 2);
      for (let y = 1; y <= 4; y++) set(cx, y, 'O');
      set(cx + 1, 1, 'F'); set(cx + 2, 1, 'F'); set(cx + 1, 2, 'F');
    }
    return g;
  },

  // Run-length encode each pixel row into crisp SVG rects (one per color run).
  svg(w, tierId) {
    const cols = Math.max(Math.round(w / this.P), 3);
    const g = this.sprite(cols, tierId);
    let s = '<svg width="' + (cols * this.P) + '" height="' + this.H + '" viewBox="0 0 ' + (cols * this.P) + ' ' + this.H + '" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">';
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
