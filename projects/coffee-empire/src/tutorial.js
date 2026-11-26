/* COFFEE EMPIRE — short interactive early-game tutorial (1–3 minutes).
   Rosa the barista guides the player through REAL actions: pick a drink,
   brew it, serve it, see the money, buy the first upgrade. The card never
   blocks gameplay; the current target element glows. Skippable at any time,
   replayable from Settings, and the completion state is saved. */
(function (global) {
'use strict';
const CE = global.CE = global.CE || {};

const T = CE.Tutorial = {
  card: null, target: null, baseCups: 0,
  steps: [
    { id: 'welcome', nav: 'brew',
      text: "Hi, I'm Rosa — your barista! ☕ This little cart is all yours. Let's make your first coffee together.",
      button: "Let's brew!" },
    { id: 'pick', nav: 'brew',
      text: 'Tap <b>Regular Coffee</b> to start your first brew.',
      target: '[data-action="brew-select"][data-id="regular"]',
      advance: S => !!S.brewSession },
    { id: 'work', nav: 'brew',
      text: 'Great! Now work through the steps — tap the glowing button to grind the beans and brew.',
      target: '.brew-step.current .brew-action',
      advance: S => {
        const ses = S.brewSession;
        if (S.stats.cups > T.baseCups) return true;
        if (!ses) return false;
        return ses.step >= CE.DRINKS[ses.drink].steps.length - 1;
      } },
    { id: 'serve', nav: 'brew',
      text: 'Here comes your first customer! <b>Serve</b> the coffee to collect payment.',
      target: '.brew-step.current .brew-action',
      advance: S => S.stats.cups > T.baseCups },
    { id: 'money',
      text: 'Ka-ching! 💰 Your cash lives up top. Profit = revenue minus costs — and while your business is young, costs can never bankrupt you. Brew at your own pace!',
      target: '#tb-cash', button: 'Got it!' },
    { id: 'upgrade', nav: 'businesses',
      text: 'Time for your first upgrade! <b>Sturdy Paper Cups</b> ($60) make every manual brew worth more. Upgrades live on the Businesses page.',
      target: '[data-action="upgrade"][data-id="paperCups"]',
      advance: S => !!S.upgrades.paperCups, later: 'Maybe later' },
    { id: 'done',
      text: "You're a natural! 🎉 New recipes, employees and whole industries unlock as you grow — the Milestones page shows what's next. The empire is yours!",
      button: 'Open for business!' }
  ],

  start(S) {
    S.tutorial = { done: false, skipped: false, active: true, step: 0 };
    this.baseCups = S.stats.cups;
    this.render(S);
    CE.save(S);
  },
  skip(S) {
    S.tutorial.skipped = true;
    S.tutorial.active = false;
    this.destroy();
    CE.save(S);
    CE.notify('Tutorial skipped — replay it anytime from Settings.', 'info');
  },
  finish(S) {
    S.tutorial.done = true;
    S.tutorial.active = false;
    this.destroy();
    CE.save(S);
    CE.notify('🎓 Tutorial complete! Build your coffee empire.', 'good');
  },
  next(S) {
    if (!S.tutorial.active) return;
    if (S.tutorial.step >= this.steps.length - 1) return this.finish(S);
    S.tutorial.step++;
    const st = this.steps[S.tutorial.step];
    if (st.nav && CE.UI && CE.UI.S && CE.UI.section !== st.nav) CE.UI.show(st.nav);
    this.render(S);
  },

  /* Called at 4 Hz from UI.update: advance on real gameplay, keep highlight. */
  update(S) {
    if (!S.tutorial || !S.tutorial.active) { if (this.card) this.destroy(); return; }
    const st = this.steps[S.tutorial.step];
    if (st && st.advance) {
      let ok = false;
      try { ok = st.advance(S); } catch (e) { ok = false; }
      if (ok) { this.next(S); return; }
    }
    this.attach(S);
  },

  /* (Re)apply the glow to the current target after any UI rebuild. */
  attach(S) {
    if (!S.tutorial || !S.tutorial.active || typeof document === 'undefined') return;
    const st = this.steps[S.tutorial.step];
    let el = null;
    if (st.target && document.querySelector) el = document.querySelector(st.target);
    if (!el && st.nav && document.querySelector) {
      el = document.querySelector('.bnav-btn[data-id="' + st.nav + '"]') ||
        document.querySelector('.nav-btn[data-id="' + st.nav + '"]');
    }
    if (el !== this.target) {
      if (this.target && this.target.classList) this.target.classList.remove('tut-target');
      this.target = el;
      if (el && el.classList) el.classList.add('tut-target');
    }
  },

  render(S) {
    if (typeof document === 'undefined') return;
    if (document.body && document.body.classList) document.body.classList.add('tut-active');
    if (!this.card) {
      this.card = document.createElement('div');
      this.card.id = 'tutorial-card';
      document.body.appendChild(this.card);
    }
    const st = this.steps[S.tutorial.step];
    const dots = this.steps.map((x, i) =>
      '<span class="tut-dot' + (i < S.tutorial.step ? ' done' : i === S.tutorial.step ? ' current' : '') + '"></span>').join('');
    this.card.innerHTML =
      '<img class="sprite tut-face" src="' + CE.spriteURL('barista', 64) + '" alt="" draggable="false">' +
      '<div class="tut-body">' +
      '<div class="tut-head"><b>Rosa</b><span class="tut-dots">' + dots + '</span>' +
      '<button class="tut-skip" data-action="tut-skip">Skip ✕</button></div>' +
      '<p class="tut-text">' + st.text + '</p>' +
      (st.button ? '<button class="btn primary small" data-action="tut-next">' + st.button + '</button>' : '') +
      (st.later ? '<button class="btn small" data-action="tut-next">' + st.later + '</button>' : '') +
      '</div>';
    this.attach(S);
  },

  destroy() {
    if (typeof document !== 'undefined' && document.body && document.body.classList) document.body.classList.remove('tut-active');
    if (this.target && this.target.classList) this.target.classList.remove('tut-target');
    this.target = null;
    if (this.card) { this.card.remove(); this.card = null; }
  }
};
})(typeof window !== 'undefined' ? window : globalThis);