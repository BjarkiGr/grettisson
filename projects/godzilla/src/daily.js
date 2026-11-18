// Daily Rampage: a date-seeded score attack, one scored run per day.
// All persistence lives in localStorage - no server or database needed.
const Daily = {
  EPOCH: Date.UTC(2026, 10, 18), // launch day = puzzle #1
  KEY: 'godzilla-daily-v1',

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

  // Wordle-style spoiler-free summary for the clipboard.
  shareText(res) {
    const segs = res.segments.map((s) =>
      s.water ? (s.kills > 0 ? '🚤' : '🌊')
              : (s.smashed >= 3 ? '💥' : s.smashed > 0 ? '🏙️' : '⬛')
    ).join('');
    const mins = Math.floor(res.time / 60);
    const secs = Math.round(res.time % 60);
    const beamPct = res.beamTicks > 0 ? Math.round((100 * res.beamHits) / res.beamTicks) : 0;
    return '🦖 Daily Rampage #' + res.number + ' — ' + res.score + ' pts\n' +
      segs + '\n' +
      '🔥 x' + res.maxCombo + ' combo · ⚡ ' + beamPct + '% beam · ⏱️ ' +
      mins + ':' + String(secs).padStart(2, '0') + '\n' +
      'grettisson.is/projects/godzilla/';
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