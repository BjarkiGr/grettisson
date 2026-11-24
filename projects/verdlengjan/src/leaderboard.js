// One-click submit to the shared Daily Games Stats leaderboard (Supabase).
// Same PUBLIC publishable key as projects/daily-games-stats/script.js - it is
// designed to be public; RLS blocks everything except the API functions.
// Plain fetch, no SDK - same convention as the rest of the game.
const Leaderboard = {
  URL: 'https://zseurcwufrhmqvrmanqp.supabase.co',
  KEY: 'sb_publishable_ehl5_wRvgnzsG7bZeFVZLA_4yjbJfT0',
  STORAGE: 'verdlengjan-player',

  player() {
    try {
      const raw = localStorage.getItem(this.STORAGE);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage unavailable */ }
    return null;
  },
  savePlayer(p) {
    try { localStorage.setItem(this.STORAGE, JSON.stringify(p)); } catch (e) { /* ignore */ }
  },

  async rpc(fn, body) {
    const res = await fetch(this.URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.KEY,
        Authorization: 'Bearer ' + this.KEY,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = 'Villa ' + res.status;
      try { const j = await res.json(); if (j && j.message) msg = j.message; } catch (e) { /* keep default */ }
      throw new Error(msg);
    }
    return res.json();
  },

  // Login first; if that fails, try registering (new player). If registration
  // also fails (e.g. the name exists and the PIN was wrong), surface the
  // original login error - same net effect as the leaderboard site's flow.
  async login(name, pin) {
    let loginErr = null;
    try { await this.rpc('login_player', { p_name: name, p_pin: pin }); }
    catch (e) { loginErr = e; }
    if (loginErr) {
      try { await this.rpc('register_player', { p_name: name, p_pin: pin }); }
      catch (e) { throw loginErr; }
    }
    const p = { name, pin };
    this.savePlayer(p);
    return p;
  },

  // Matches the paste-parser format on the leaderboard site exactly:
  // tier emoji row (+ fimmtudagsbonus on the same line, like the share text).
  payload(res, player) {
    const row = res.guesses.map((g) => tierById(g.tierId).emoji).join('');
    return {
      p_name: player.name,
      p_pin: player.pin,
      p_game: 'verdlengjan',
      p_puzzle: res.number,
      p_score: res.totalCm,
      p_grid: row + (res.thursdayBonus ? ' + 🥐 fimmtudagsbonus!' : ''),
      p_rounds: [],
    };
  },

  async submit(res, player) {
    return this.rpc('submit_score', this.payload(res, player));
  },
};
