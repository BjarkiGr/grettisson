/* COFFEE EMPIRE — large number abstraction.
   Mantissa/exponent decimal (1 <= |m| < 10) supporting fractional rates,
   huge values far beyond Number.MAX_SAFE_INTEGER, and JSON-safe serialization. */
(function (global) {
'use strict';
const CE = global.CE = global.CE || {};

class Big {
  constructor(m, e) {
    if (!isFinite(m) || m === 0) { this.m = 0; this.e = 0; return; }
    e = e | 0;
    while (m >= 10 || m <= -10) { m /= 10; e++; }
    while (m < 1 && m > -1) { m *= 10; e--; }
    this.m = m; this.e = e;
  }
  static from(x) {
    if (x instanceof Big) return x;
    if (typeof x === 'number') return Big.fromNumber(x);
    if (x && typeof x === 'object') {
      if (x.__b) return new Big(x.__b[0], x.__b[1]);
      if (typeof x.m === 'number') return new Big(x.m, x.e || 0);
    }
    if (typeof x === 'string') { const n = parseFloat(x); return Big.fromNumber(isNaN(n) ? 0 : n); }
    return Big.ZERO;
  }
  static fromNumber(n) {
    if (!isFinite(n) || n === 0) return new Big(0, 0);
    const e = Math.floor(Math.log10(Math.abs(n)));
    return new Big(n / Math.pow(10, e), e);
  }
  clone() { return new Big(this.m, this.e); }
  isZero() { return this.m === 0; }
  neg() { return new Big(-this.m, this.e); }
  abs() { return new Big(Math.abs(this.m), this.e); }
  add(o) {
    o = Big.from(o);
    if (this.m === 0) return o.clone();
    if (o.m === 0) return this.clone();
    const d = this.e - o.e;
    if (d > 17) return this.clone();
    if (d < -17) return o.clone();
    if (d >= 0) return new Big(this.m + o.m / Math.pow(10, d), this.e);
    return new Big(this.m / Math.pow(10, -d) + o.m, o.e);
  }
  sub(o) { return this.add(Big.from(o).neg()); }
  mul(o) { o = Big.from(o); return new Big(this.m * o.m, this.e + o.e); }
  mulNum(n) { return new Big(this.m * n, this.e); }
  div(o) {
    o = Big.from(o);
    if (o.m === 0) return Big.ZERO;
    return new Big(this.m / o.m, this.e - o.e);
  }
  divNum(n) { return n === 0 ? Big.ZERO : new Big(this.m / n, this.e); }
  pow(n) {
    if (this.m === 0) return Big.ZERO;
    if (n === 0) return Big.ONE;
    const l = this.log10() * n;
    const e = Math.floor(l);
    return new Big(Math.pow(10, l - e), e);
  }
  log10() { return this.m === 0 ? -Infinity : this.e + Math.log10(Math.abs(this.m)); }
  cmp(o) {
    o = Big.from(o);
    if (this.m === 0 && o.m === 0) return 0;
    if (this.m === 0) return o.m > 0 ? -1 : 1;
    if (o.m === 0) return this.m > 0 ? 1 : -1;
    if (this.m > 0 && o.m < 0) return 1;
    if (this.m < 0 && o.m > 0) return -1;
    const sign = this.m > 0 ? 1 : -1;
    if (this.e !== o.e) return (this.e > o.e ? 1 : -1) * sign;
    if (this.m === o.m) return 0;
    return this.m > o.m ? 1 : -1;
  }
  gte(o) { return this.cmp(o) >= 0; }
  gt(o) { return this.cmp(o) > 0; }
  lte(o) { return this.cmp(o) <= 0; }
  lt(o) { return this.cmp(o) < 0; }
  eq(o) { return this.cmp(o) === 0; }
  gteNum(n) { return this.cmp(Big.fromNumber(n)) >= 0; }
  toNumber() { return this.m * Math.pow(10, this.e); }
  toJSON() { return { __b: [this.m, this.e] }; }
  toString() { return CE.fmt(this); }
}
Big.ZERO = new Big(0, 0);
Big.ONE = new Big(1, 0);
CE.Big = Big;
CE.bigReviver = function (key, value) {
  if (value && typeof value === 'object' && value.__b) return new Big(value.__b[0], value.__b[1]);
  return value;
};

/* ---------- Formatting ---------- */
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
  'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];
CE.fmtMode = 'short';
CE.fmt = function (x, mode) {
  const b = Big.from(x);
  mode = mode || CE.fmtMode;
  if (b.m === 0) return '0';
  const neg = b.m < 0 ? '-' : '';
  const a = b.abs();
  if (mode === 'sci' || a.e >= SUFFIX.length * 3) return neg + a.m.toFixed(2) + 'e' + a.e;
  if (mode === 'full') {
    const n = a.toNumber();
    if (a.e < 15 && isFinite(n)) return neg + n.toLocaleString('en-US', { maximumFractionDigits: a.e < 3 ? 2 : 0 });
    return neg + a.m.toFixed(2) + 'e' + a.e;
  }
  if (a.e < 0) { const n = a.toNumber(); return neg + (n < 0.01 ? n.toExponential(1) : n.toFixed(2)); }
  if (a.e < 3) {
    const n = a.toNumber();
    return neg + (a.e < 1 ? n.toFixed(2) : a.e < 2 ? n.toFixed(1) : Math.round(n).toString());
  }
  const idx = Math.floor(a.e / 3);
  const v = a.m * Math.pow(10, a.e - idx * 3);
  return neg + (v >= 100 ? v.toFixed(1) : v.toFixed(2)) + SUFFIX[idx];
};
CE.fmtMoney = function (x, mode) { const b = Big.from(x); return (b.m < 0 ? '-$' : '$') + CE.fmt(b.abs(), mode); };
/* Plain-number quantity formatter (inventories, rates). */
CE.fmtQty = function (n, unit) {
  let s;
  if (!isFinite(n)) s = '∞';
  else if (Math.abs(n) >= 1e6) s = CE.fmt(Big.fromNumber(n));
  else if (Math.abs(n) >= 1000) s = Math.round(n).toLocaleString('en-US');
  else if (Math.abs(n) >= 100) s = n.toFixed(0);
  else if (Math.abs(n) >= 1) s = n.toFixed(1);
  else s = n.toFixed(2);
  return unit ? s + ' ' + unit : s;
};
CE.fmtPct = function (x, digits) { return (x * 100).toFixed(digits == null ? 1 : digits) + '%'; };
CE.fmtTime = function (s) {
  s = Math.max(0, Math.floor(s));
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return d + 'd ' + (h % 24) + 'h';
  if (h > 0) return h + 'h ' + String(m % 60).padStart(2, '0') + 'm';
  return m + 'm ' + String(s % 60).padStart(2, '0') + 's';
};
/* Geometric cost helpers: cost(n) = base * growth^n. */
CE.costAt = function (base, growth, owned) { return Big.from(base).mul(Big.fromNumber(growth).pow(owned)); };
CE.costFor = function (base, growth, owned, count) {
  if (count <= 0) return Big.ZERO;
  const first = CE.costAt(base, growth, owned);
  return first.mulNum((Math.pow(growth, count) - 1) / (growth - 1));
};
CE.maxAffordable = function (base, growth, owned, cash) {
  const first = CE.costAt(base, growth, owned);
  if (Big.from(cash).lt(first)) return 0;
  const ratio = Big.from(cash).mulNum(growth - 1).div(first).add(Big.ONE);
  const k = Math.floor(ratio.log10() / Math.log10(growth));
  return Math.max(0, Math.min(k, 100000));
};
/* Ownership milestone multiplier: x2 at 10, 25, 50, then every 50 to 500, every 100 beyond. */
CE.milestoneMult = function (n) {
  let mult = 1;
  const th = [10, 25, 50];
  for (let i = 100; i <= 500; i += 50) th.push(i);
  for (let i = 600; i <= 5000; i += 100) th.push(i);
  for (const t of th) { if (n >= t) mult *= 2; else break; }
  return mult;
};
CE.nextMilestone = function (n) {
  const th = [10, 25, 50];
  for (let i = 100; i <= 500; i += 50) th.push(i);
  for (let i = 600; i <= 5000; i += 100) th.push(i);
  for (const t of th) if (n < t) return t;
  return (Math.floor(n / 100) + 1) * 100;
};
})(typeof window !== 'undefined' ? window : globalThis);
