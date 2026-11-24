// Anonymous traffic telemetry: one 'visit' per browser per day (on boot) and
// one 'complete' per daily finish. Counted in the same Supabase project as
// Daily Games Stats (verd_track / verd_traffic) - no personal data, just a
// random client id in localStorage. Failures are always silent: the game
// must never depend on telemetry working.
const Telemetry = {
  CLIENT_KEY: 'verdlengjan-client',
  VISIT_KEY: 'verdlengjan-visited',

  clientId() {
    try {
      let id = localStorage.getItem(this.CLIENT_KEY);
      if (!id) {
        id = (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = Math.floor(Math.random() * 16);
              return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
            });
        localStorage.setItem(this.CLIENT_KEY, id);
      }
      return id;
    } catch (e) { return null; }
  },

  async track(event) {
    try {
      const client = this.clientId();
      if (!client) return;
      await Leaderboard.rpc('verd_track', {
        p_client: client,
        p_puzzle: Daily.number(),
        p_event: event,
      });
    } catch (e) { /* silent - telemetry is best-effort */ }
  },

  // One visit per browser per day (refreshes don't inflate the count).
  visit() {
    try {
      const today = Daily.today();
      if (localStorage.getItem(this.VISIT_KEY) === today) return;
      localStorage.setItem(this.VISIT_KEY, today);
      this.track('visit');
    } catch (e) { /* silent */ }
  },
};
