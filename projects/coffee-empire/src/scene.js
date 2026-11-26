/* COFFEE EMPIRE — living shop scene. A tiny animated pixel diorama of the
   coffee cart: the barista works the machine, customers walk in, wait, get
   their cup, react happily and leave. Purely decorative and non-blocking —
   gameplay never waits on an animation. All motion is CSS transforms/opacity
   (GPU-friendly on mobile); characters reuse the 16x16 sprite system. */
(function (global) {
'use strict';
const CE = global.CE = global.CE || {};

const CUSTOMERS = ['customer1', 'customer2', 'customer3', 'customer4'];

CE.Scene = {
  /* Mount a scene inside `el`. Returns a controller with update(S)/destroy(). */
  mount(el, S) {
    if (!el || typeof document === 'undefined') return null;
    el.innerHTML =
      '<div class="scene-window"><i></i></div>' +
      '<div class="scene-lamp"></div>' +
      '<div class="scene-shelf">' + CE.spriteImg('bean', 'shelf-item', 24) + CE.spriteImg('cup', 'shelf-item', 24) +
      '<span class="scene-plant">' + CE.spriteImg('tree', 'shelf-plant', 32) + '</span></div>' +
      '<img class="scene-machine sprite" src="' + CE.spriteURL('machine', 48) + '" alt="" draggable="false">' +
      '<div class="scene-steam"><i></i><i></i><i></i></div>' +
      '<img class="scene-barista sprite" src="' + CE.spriteURL('barista', 48) + '" alt="" draggable="false">' +
      '<div class="scene-counter"></div>' +
      '<div class="scene-lane"></div>';
    const q = sel => (el.querySelector ? el.querySelector(sel) : null);
    const ctrl = {
      el,
      lane: q('.scene-lane'),
      barista: q('.scene-barista'),
      steam: q('.scene-steam'),
      timers: [], customers: 0, lastCups: S ? S.stats.cups : 0, lastState: '',
      reduced: !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches),
      later(fn, ms) { const t = setTimeout(fn, ms); this.timers.push(t); return t; },
      update(S) {
        /* Barista animation state follows the real brew session. */
        const ses = S.brewSession;
        let state = 'idle';
        if (ses && ses.running) {
          const step = CE.DRINKS[ses.drink].steps[ses.step];
          state = step === 'grind' ? 'grind' : (step === 'brew' || step === 'steep') ? 'brew' :
            step === 'steam' ? 'steam' : step === 'serve' ? 'serve' : 'prep';
        } else if (S.staff.barista.n > 0) state = 'auto';
        if (state !== this.lastState) {
          this.lastState = state;
          if (this.barista) this.barista.className = 'scene-barista sprite st-' + state;
          if (this.steam) this.steam.classList.toggle('on', state === 'brew' || state === 'steam' || state === 'auto');
        }
        /* Real sales (manual or automated) bring real customers. */
        const d = S.stats.cups - this.lastCups;
        this.lastCups = S.stats.cups;
        if (d > 0 && S.settings.animations && !this.reduced && !document.hidden && this.customers < 3) this.spawn();
      },
      spawn() {
        if (!this.lane) return;
        const self = this;
        const w = this.el.clientWidth || 320;
        const c = document.createElement('div');
        c.className = 'scene-customer';
        const dist = -(w - 150 - Math.floor(Math.random() * 40));
        if (c.style.setProperty) {
          c.style.setProperty('--dist', dist + 'px');
          c.style.setProperty('--out', -(w + 60) + 'px');
        } else { c.style['--dist'] = dist + 'px'; c.style['--out'] = -(w + 60) + 'px'; }
        c.innerHTML =
          '<img class="sprite cust-sprite" src="' + CE.spriteURL(CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)], 48) + '" alt="" draggable="false">' +
          '<img class="sprite scene-heart" src="' + CE.spriteURL('heart', 24) + '" alt="" draggable="false">' +
          '<img class="sprite scene-cup" src="' + CE.spriteURL('cup', 24) + '" alt="" draggable="false">';
        this.lane.appendChild(c);
        this.customers++;
        /* walk in → wait at the counter → receive cup + heart → walk out */
        this.later(() => c.classList.add('in'), 30);
        const wait = 1600 + 500 + Math.random() * 900;
        this.later(() => {
          c.classList.add('happy');
          self.coin();
        }, wait);
        this.later(() => c.classList.add('out'), wait + 800);
        this.later(() => { c.remove(); self.customers = Math.max(0, self.customers - 1); }, wait + 2700);
      },
      coin() {
        if (!this.lane) return;
        const k = document.createElement('img');
        k.className = 'sprite scene-coin';
        k.src = CE.spriteURL('coin', 24);
        k.alt = '';
        this.lane.appendChild(k);
        this.later(() => k.remove(), 900);
      },
      destroy() {
        this.timers.forEach(t => clearTimeout(t));
        this.timers.length = 0;
        if (this.lane) this.lane.innerHTML = '';
        this.customers = 0;
      }
    };
    return ctrl;
  }
};
})(typeof window !== 'undefined' ? window : globalThis);