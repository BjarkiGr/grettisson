# COFFEE EMPIRE — Game Review Brief (for ChatGPT)

> **How to use this file:** Paste this entire document into ChatGPT as context, then
> attach or paste the game's source files (listed in §4) if you want a code-level review.
> The game itself is a single static folder — open `index.html` in a browser to play.
> The original full requirements are in `instructions.txt` in the same folder.

---

## 1. Your role as reviewer

You are an experienced **game designer, economy designer and JavaScript engineer**
reviewing a finished incremental/idle tycoon game called **COFFEE EMPIRE**.

Produce a critical, honest review — not a summary. Prioritize:

1. **Economy & balance flaws** (progression walls, dead ends, exploitable loops,
   inflation, useless upgrades, businesses that become irrelevant).
2. **Spec compliance gaps** versus the requirements checklist in §3.
3. **Simulation correctness** (resource conservation, offline math, save integrity,
   big-number handling, floating-point pitfalls).
4. **UX problems** (information overload, unclear feedback, micromanagement,
   mobile usability, accessibility).
5. **Code quality risks** (state mutation bugs, performance at scale, render churn).

For every issue: severity (Critical / Major / Minor / Nit), where it lives
(file + system), why it matters, and a concrete fix suggestion.
End with scores (0–10) for: Fun/Progression, Economic Depth, Spec Compliance,
Technical Quality, Presentation — and a one-paragraph verdict.

---

## 2. What the game is

A complete, offline-capable browser incremental tycoon: start with a coffee cart
and $100, build the world's largest coffee corporation. Vanilla HTML/CSS/JS,
no frameworks, no backend, no external assets. Runs from `file://`.

**Core loop:** interactive manual brewing (step-by-step Brew screen) → milestone
unlocks → hire first barista (cart automates) → discover & buy businesses →
own the production chain (farms → processing → roasting → grinding → packaging
→ logistics → retail) → automate via research → expand internationally →
acquire competitors → prestige ("LEGACY") for permanent bonuses → repeat.

**v2 redesign (current state):** zero passive starting income (unstaffed
businesses produce nothing); interactive timed brew pipeline with per-step
ingredient consumption and equipment upgrades; gradual automation via staff +
research; HIDDEN/AVAILABLE/OWNED business discovery (undiscovered businesses are
never shown); 43 persistent milestones unlocking recipes/staff/businesses/
research categories/features; mobile-first UI with fixed bottom nav
(Home/Brew/Businesses/Production/More), bottom-sheet dialogs and safe-area
support; save version 2 with full legacy migration.

**Content inventory (all implemented, data-driven):**
- 48 businesses in 6 categories, geometric cost scaling (g ≈ 1.15–1.25),
  ownership milestones (×2 at 10/25/50, then every 50 to 500, every 100 beyond)
- 24 stored resources + 12 drink products + 9 packaged products
- 276 upgrades (5-tier tree per business + 31 globals + 6 infinite repeatables)
- 38-node research tree, 8 categories, RP cost + real-time duration, queue of 5
- 11 employee types (salary, staffing ratio, XP/skill, manager bonuses)
- 6 regions with distinct opex/labor/demand/farm-yield/market-size; regional divisions
- 7 fluctuating commodities, 13 timed economic events, 3 marketing campaigns
- 5 AI competitors (compound growth, acquirable), 8 acquisition targets,
  subsidiaries (mergeable), market-share model
- LEGACY prestige: LP = floor(sqrt(runRevenue / 1e9) × (1 + 0.1·lg_earn)),
  10 permanent upgrade tracks
- 45 achievements (7 hidden), each +1% global revenue + RP reward
- Offline progression: chunked simulation, 12h base cap (+research/+Legacy),
  75% base efficiency (+5%/Legacy level), welcome-back summary
- Statistics: lifetime + per-business reports, 5 canvas charts
- Procedural 16×16 pixel art (48 palette-variant sprites), WebAudio cues + music,
  volume control, responsive layout, JSON export/import, backup save recovery

---

## 3. Spec compliance checklist (from instructions.txt)

| Spec section | Status | Implementation notes |
|---|---|---|
| 1 Concept / core principles | ✅ | Passive income, multipliers, unlocks, chains, automation, prestige, offline |
| 2 Visual design | ✅ | Cream/espresso palette, canvas pixel sprites, `image-rendering: pixelated` |
| 3 Starting gameplay | ✅ | $100, 1 cart, 1kg roasted + milk/sugar/water, manual brew, no staff |
| 4 Business catalog (48) | ✅ | All 48 named businesses; configurable cost formulas |
| 5 Products & resources | ✅ | All listed drinks/packaged/raws; units kg/L/u; per-hour tooltips |
| 6 Production chains | ✅ | Real recipes, storage caps, utilization, bottleneck warnings, auto-buy thresholds, suppliers, recipe priorities, pause toggles |
| 7 Complex economy | ✅ | Revenue/COGS/opex/wages split; price elasticity; finite demand; 7 commodities; gross/net/margin/assets/liabilities reports |
| 8 Employees | ✅ | 11 types, XP, managers automate/boost; company-wide staffing upgrades |
| 9 Upgrades (hundreds) | ✅ | 276, data-driven, repeatables + permanent unlocks + milestones |
| 10 Research tree | ✅ | 38 nodes, real feature unlocks (autoBuy, scheduling, autoDist, acquisitions, +12h offline) |
| 11 Brand & customers | ✅ | Reputation 0–100, milestones at 25/50/75/100, campaigns, quality factors |
| 12 International expansion | ✅ | 6 regions, per-region ownership, divisions, intl multiplier |
| 13 Competitors & events | ✅ | 5 growing AI rivals, 13 events with durations/effects/notifications |
| 14 Acquisitions & corporate | ✅ | Competitor buyouts, 8 targets, merge subsidiaries, regional divisions |
| 15 LEGACY prestige | ✅ | Optional; keeps achievements/lifetime stats/LP/upgrades |
| 16 Achievements | ✅ | 45 incl. hidden, rewards, progress bars |
| 17 Offline progression | ✅ | Timestamp-based chunked sim (≤240 chunks), respects bottlenecks/costs, summary modal |
| 18 Statistics | ✅ | All listed metrics + revenue/profit/valuation/cash/production charts |
| 19 Interface details | ✅ | Top bar, sidebar (10 spec sections + Staff), buy 1/10/100/MAX, settings incl. reset confirm |
| 20 Technical | ✅ | Plain scripts (file:// safe), single state, 8 Hz loop, 4 Hz targeted UI updates, mantissa/exponent big numbers, 30s autosave, JSON export/import, versioning, backup recovery |
| 21 Balancing | ✅* | Configurable data; verified by bot playtest — *scrutinize late-game curve* |
| 22 Sound & feedback | ✅ | Distinct cues per action type, volume slider, mute, animations |
| 23 Quality requirements | ✅* | Headless tests pass — *scrutinize edge cases listed in §7* |

---

## 4. Architecture & file map

Plain ordered `<script>` tags (no ES modules, so `file://` works). Everything lives
on one global `CE` namespace with a **single authoritative state object** `CE.S`.

```
projects/coffee-empire/
├── index.html            Layout shell: top bar, sidebar, main, toasts, modal root
├── style.css             Full theme (~370 lines), responsive breakpoints 900/700px
├── instructions.txt      The original full game spec (review against this)
├── src/
│   ├── bignum.js         Big class {m,e} mantissa/exponent; JSON-safe ({__b:[m,e]});
│   │                     add/sub/mul/div/pow/cmp/log10; fmt (K…Dc→sci); geometric
│   │                     cost helpers (costAt/costFor/maxAffordable); milestones
│   ├── data.js           24 resources, 12 drinks (recipes+elasticity), 48 businesses
│   │                     (cost/g/opex/staff/unlock/recipes/menus/sells), 11 staff, 6 regions
│   ├── data2.js          240 generated per-business upgrades + 31 globals + 6 repeatables
│   ├── data3.js          38 research nodes, 13 events, 3 campaigns, 5 competitors, 8 acquisitions
│   ├── data4.js          45 achievements (+progress fns), 10 Legacy upgrades
│   ├── sprites.js        16×16 char-map pixel art → canvas dataURLs; 40+ palette variants
│   ├── state.js          newState(), applyLegacyStart(), serialize/deserialize (versioned,
│   │                     merged onto defaults), save w/ backup, load w/ recovery, JSON export/import
│   ├── engine.js         THE simulation (~950 lines): computeMods (all multipliers),
│   │                     staffing, capacities, tick(S,dt), triggerEvent, simulateOffline,
│   │                     all player actions (brew/buy/hire/upgrade/research/campaign/
│   │                     acquire/division/merge/pause/prestige/legacy), objectives
│   ├── ui.js             UI core: nav, event delegation (data-action), targeted updates,
│   │                     toasts, modals, charts; Overview, Businesses, Staff sections
│   ├── ui2.js            Production, Locations, Farms, Research sections
│   ├── ui3.js            Markets, Corporate, Achievements, Statistics sections
│   └── main.js           Boot, 8 Hz setInterval loop (elapsed-time dt), 4 Hz UI,
│   │                     1 Hz structural rebuild, autosave, WebAudio (blips/cues/music)
└── test/
    ├── smoke.js          71 headless checks (node test/smoke.js)
    ├── ui.js             DOM-shim render/update/click tests (node test/ui.js)
    └── progression.js    40-min honest bot playthrough (node test/progression.js)
```

**Loop design:** one `setInterval(125ms)`; `dt = (now − last)/1000` (capped 300s).
`E.tick(S, dt)` does everything: wages → farms → factories (recipe weights, input
& storage & cash gating) → logistics → retail (per-drink demand, ingredient
scaling) → distribution (shared transport budget) → corporate → auto-buy →
interest/subsidiaries → brand → research → markets (5s) → events → competitors
(5s) → history samples (5s) → achievements (1s) → finalize cash/rates.
UI never re-renders per tick: text nodes update at 4 Hz; full section rebuild only
when a structural signature (unlocks/achievements/research/regions) changes.

**Big numbers:** money uses `Big` (mantissa/exponent, ~15 significant digits,
exponent unbounded). Resource quantities, rates and counts are plain JS numbers
(inventories are storage-capped, so precision loss is irrelevant). `Big` serializes
as `{__b:[m,e]}` and is revived by a JSON reviver — never raw BigInt.

---

## 5. Key balance parameters (scrutinize these)

- Start: $100, 1 cart, 1kg roasted beans + milk/sugar/water, NO employees.
  Unstaffed businesses produce **zero** (efficiency 0) unless category automation
  is researched; closed businesses still pay rent. Brand 5 → demand ≈ 0.47 early.
- Manual brew: timed steps (grind 1.5s, prep 1s, brew 2s, steam 1.5s, steep 6s,
  serve 0.5s) ÷ brewSpeed; equipment removes/halves steps; payment only on serve.
  Shops without a manager run at 60% (supervised); managers/regional research → 100%.
- Early milestones: 1 cup → 10 (americano) → 25 (cappuccino) → $250 (barista hire)
  → hire (Automation research) → 100 (mocha/cold brew) → $500 (first shop) →
  $1,000 (shop managers + full menu) → 2 locations.
- Business cost: `base × g^owned`, g = 1.15 (retail) … 1.25 (globalCorp).
  Base costs span $100 (cart) → $1e15 (Global Coffee Corporation).
- Opex per unit/s spans $0.02 (cart) → $3e10 (globalCorp); wages $0.04–$25/s.
- Hire costs are **flat** (deliberate: late-game needs thousands of staff;
  wages are the balance lever). Efficiency = max(floor, 0.3 + 0.7·ratio^0.7) × (1 + 0.5·XP).
- Demand: `min(1, region.demand × brandFactor × demandMult × compF × priceMult^−elasticity × qualityF)`;
  brandFactor = 0.6 + brand/100·0.9; elasticity 1.0–1.6; price slider 50–250%.
- Markets: random walk ±3%/5s + 2% mean reversion, clamped 0.3–4×; events multiply.
- Competitors: compound growth 0.06–0.11%/s (price-war event doubles it);
  market share = playerRev / (playerRev + Σ rivalRev).
- Prestige at ≥$1e9 run revenue; LP = floor(√(runRev/1e9)); Legacy costs grow ×1.6–3/level.
- Offline: ≤240 chunks of ≤300s each; revenue × efficiency (0.75 base), expenses full.
- Materials recipes (packaging/bottles/capsules/machines) charge `cashIn` COGS per
  cycle and scale down when cash is short — nothing is produced from nothing.

---

## 6. Deliberate design decisions (judge these, don't just flag them)

1. **Plain scripts over ES modules** — required for `file://` play without a server.
2. **Mantissa/exponent Big over BigInt fixed-point** — spec allows "a suitable
   large-number abstraction"; fractional rates are natural, JSON is trivial.
3. **Plain numbers for inventories** — storage caps bound them; avoids Big overhead
   in the hot loop. Money/stats/valuations are Big.
4. **Flat hire costs** — geometric hiring made 4,000-barista workforces mathematically
   impossible; wages provide the ongoing cost pressure instead.
5. **COGS counted at purchase time** (auto-buy + materials cashIn), not at consumption —
   internally produced goods were already paid for via farm/factory opex; avoids
   double counting. Profit = revenue − purchases − opex − wages.
6. **Demand clamped at capacity** — demand factors >1 saturate rather than exceed
   physical throughput; bad pricing/events/brand push sales below capacity.
7. **Offline efficiency 75% base** — returning players earn meaningfully but less
   than active play; Legacy raises it to 100%.
8. **globalCorp multiplier capped at 2^100 then linear** — prevents Number overflow
   in the multiplier itself at absurd ownership counts.
9. **Structural-signature UI rebuilds** — avoids per-tick re-render and input focus loss.
10. **Extra "Staff" nav item** beyond the spec's 10 sections — employee management
    needed a home; spec §8 requires the system but lists no nav slot for it.

## 7. Known limitations & suggested attack surface for the review

Please probe these specifically — they are the most likely real weaknesses:

- **Late-game curve unverified by humans.** Bot tests cover 40 min (→ ~$30M) and a
  synthetic 2h mega-portfolio. The $1e12 → $1e15 stretch and multi-prestige pacing
  have not been human-playtested. Are there walls? Is prestige ever forced too early/late?
- **Big/number boundary.** Revenue per tick is computed as a plain number
  (cups × price) before conversion to Big. At extreme ownership (≥1e6 units with
  milestone ×2^57), could intermediate products lose precision or overflow?
- **Offline chunk granularity.** 300s chunks evaluate inputs at chunk start; a
  factory can over-consume within a chunk relative to true continuous simulation.
  Is the error acceptable? Does auto-buy interact sanely with long chunks?
- **Market-share feedback loop.** compF = 0.85 + 0.15·(1−share) mildly penalizes
  leaders; competitors grow forever until acquired. Can share reach 50% (monopoly
  achievement) in reasonable time, or do rivals outscale the player indefinitely?
- **Pause economics.** Paused businesses pay half rent with zero output — is there
  an exploit (e.g., pause everything during downturns)? Is half rent the right number?
- **Save size & localStorage limits.** History (288 samples × Big objects) + market
  histories + 48 business records ≈ 50–150KB. Fine today; what breaks at 5MB quota?
- **Event stacking.** Up to 3 concurrent events; multipliers compound. Worst case
  (shortage + downturn + price war) — is progress "frustrating" per spec §13?
- **UI at scale.** Businesses page renders all unlocked cards; at 48 types ×
  updates 4 Hz, is DOM churn noticeable on low-end mobile? Charts redraw at 1 Hz.
- **Accessibility.** Color-only pos/neg signals, emoji icons, no keyboard shortcuts,
  no ARIA beyond toasts. What should be improved first?
- **No cloud save / no IndexedDB** — spec permits LocalStorage; confirm adequacy.
- **Brew session exploits**: session is saved in S; steps consume ingredients at
  start, payment only on serve completion. Check cancel/reload/double-click paths.
- **Milestone pacing**: are early unlocks frequent enough? Do milestone rewards
  (recipes/staff/discovery) create a satisfying curve, or trivialize mid-game?
- **Discovery permanence**: discovered businesses stay purchasable even if unlock
  conditions lapse (e.g., reputation drops). Intended QoL — verify no abuse.
- **Prestige keeps milestones/discoveries/unlocks** (documented QoL decision) —
  does run 2 stay engaging?

## 8. Test evidence (all passing at time of writing)

- `node test/smoke.js` — **71 checks**: Big math & JSON roundtrip; data integrity
  (48 businesses, valid recipes/menus/research reqs); early game; farm→processing→
  roastery chain flows; research + auto-buy; save/load; 8h & 48h offline (cap enforced);
  events/markets/competitors; prestige math & preservation; 2h mega-portfolio stability
  (no NaN/negative inventory); **resource conservation** (no cash → no packaging);
  pause; divisions; merge; JSON export/import; **corrupted-save backup recovery**.
- `node test/ui.js` — every section renders & updates through a DOM shim; all 48
  sprites generate; click actions incl. pause/division/merge; offline modal.
- `node test/progression.js` — honest bot, 40 min, no debug money: ~$30M lifetime
  revenue, ~$60M net worth, 300+ businesses, 700+ employees, 13 research, 18+
  achievements, profitable final minute, cash never negative.

**Not tested:** real-browser rendering, audio output, touch input, long human sessions.

---

## 9. Requested deliverable

1. Issue list ordered by severity, each with: file/system, reproduction or reasoning,
   impact on player experience, concrete fix.
2. Balance assessment: early/mid/late/endgame pacing, prestige loop health,
   any dominant strategies or dead content.
3. Spec gap list (if any) versus `instructions.txt`.
4. Top 10 prioritized improvements (effort vs. impact).
5. Scores (0–10): Fun/Progression, Economic Depth, Spec Compliance, Technical Quality,
   Presentation + one-paragraph verdict.

If you need source code to verify a claim, ask for the specific file(s) from §4 —
`src/engine.js` and `src/data.js` are the most important for economy review.

