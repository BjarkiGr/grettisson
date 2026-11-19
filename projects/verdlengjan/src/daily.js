// Verðlengjan daily: a date-seeded price guesser, one scored run per day.
// All persistence lives in localStorage - no server or database needed.
// Pattern adapted from projects/godzilla/src/daily.js.
const Daily = {
  EPOCH: Date.UTC(2026, 10, 18), // launch day = puzzle #1
  KEY: 'verdlengjan-daily-v2', // v2: pixel-art era - new tiers, slider, zero-growth misses

  today() { return new Date().toISOString().slice(0, 10); },

  number(dateStr) {
    const d = dateStr || this.today();
    return Math.floor((Date.parse(d + 'T00:00:00Z') - this.EPOCH) / 86400000) + 1;
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage unavailable */ }
    return { results: {}, streak: 0, lastPlayed: null, bestUnlimited: 0 };
  },

  save(data) {
    try { localStorage.setItem(this.KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  },

  playedToday() { return !!this.load().results[this.today()]; },
  todayResult() { return this.load().results[this.today()] || null; },

  recordResult(res) {
    const data = this.load();
    const today = this.today();
    if (data.results[today]) return data; // one scored attempt per day
    const yesterday = new Date(Date.parse(today + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
    data.streak = data.lastPlayed === yesterday ? data.streak + 1 : 1;
    data.lastPlayed = today;
    data.results[today] = res;
    this.save(data);
    return data;
  },

  recordUnlimited(cm) {
    const data = this.load();
    if (cm > (data.bestUnlimited || 0)) { data.bestUnlimited = cm; this.save(data); }
    return data;
  },

  // Wordle-style spoiler-free summary for the clipboard.
  shareText(res) {
    const row = res.guesses.map((g) => tierById(g.tierId).emoji).join('');
    return '🥐 Verðlengjan #' + res.number + ' — ' + res.totalCm + ' cm\n' +
      row + (res.thursdayBonus ? ' + 🥐 fimmtudagsbonus!' : '') + '\n' +
      'grettisson.is/projects/verdlengjan/';
  },

  copyShare(res) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(this.shareText(res)).catch(() => {});
        return true;
      }
    } catch (e) { /* clipboard unavailable */ }
    return false;
  },
};
