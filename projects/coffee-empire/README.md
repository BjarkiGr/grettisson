# ☕ Coffee Empire

A progression-driven coffee management game. Start with a coffee cart and $100,
**make coffee by hand**, hire your first barista, open your first shop, build a
production chain and eventually manage a global coffee empire. Pure HTML/CSS/
vanilla JS — no backend, no frameworks, no external assets. Open `index.html`
and play (works directly from `file://`, fully offline).

## v2 gameplay redesign

- **No passive starting income.** The starting cart produces nothing until you
  hire a barista. Every business needs operational staff (or explicitly
  researched automation) before it produces. Unstaffed businesses show "Closed".
- **Interactive Brew screen** (default early-game screen): pick a drink, grind
  beans, prepare the machine, brew, steam milk, serve, get paid — timed steps,
  per-step ingredient consumption, equipment requirements, saved session state,
  anti-spam state machine. Equipment upgrades (Automatic Grinder, Professional
  Espresso Machine, Milk Steamer, Cold Brew Kit) and repeatable Barista Training
  speed it up.
- **Gradual automation**: first barista runs the cart; shop managers unlock full
  shop automation; research unlocks unstaffed operation per category
  (Automated Harvesting → farms, Automated Production → factories, Automated
  Distribution → logistics, Integrated Business Management → everything).
- **Discovery system**: undiscovered businesses are completely hidden. Meeting
  requirements discovers them (with a notification); discovered businesses stay
  visible and purchasable. Portfolio filter on the Businesses page.
- **43 milestones** (Sales / Revenue / Company / Knowledge) unlocking recipes,
  employee types, businesses, research categories and features — with a
  dedicated Milestones screen, progress bars and completion notifications.
  Early sequence: first cup → 10 sold → 25 sold → $250 (barista) → hire →
  100 sold → $500 (first shop) → $1,000 (shop management) → second location.
- **Mobile-first UI**: fixed bottom nav (Home / Brew / Businesses / Production /
  More), bottom-sheet dialogs, safe-area support, touch-sized controls.
- **Save v2 migration**: old saves keep all money/businesses/research/upgrades/
  achievements/stats; discovery, milestones and automation data are initialized
  with full legacy visibility (milestones already met are marked silently).

## Features

- **48 businesses** across retail, agriculture, manufacturing, logistics,
  distribution and corporate tiers, with geometric cost scaling and
  ownership milestones (x2 at 10/25/50/…).
- **Full production chain**: cherries → green beans → roasted → ground →
  packaged products → retail/distribution sales, with real input/storage
  bottlenecks, utilization tracking and recipe priorities.
- **24 resources** with inventories, storage caps, market prices,
  auto-purchasing (min/max thresholds, supplier choice) and manual trading.
- **Complex economy**: revenue vs COGS vs opex vs wages, price elasticity,
  finite demand, brand reputation, 7 fluctuating commodities, 13 economic
  events, marketing campaigns.
- **Employees**: 11 categories with salaries, staffing ratios, experience,
  manager bonuses.
- **276 upgrades** (per-business trees + globals + repeatables) and a
  **38-node research tree** in 8 categories that unlocks real automation.
- **6 regions** with distinct economics; international expansion; regional
  divisions (+25% regional revenue).
- **5 AI competitors** that grow over time and can be acquired; 8 acquisition
  targets; subsidiaries (mergeable for +10% revenue); market share tracking.
- Per-business **pause/resume** controls (paused facilities pay half rent).
- **Brand recognition milestones** (+10% demand at 25/50/75/100 reputation).
- Materials recipes charge explicit COGS — production chains never create
  resources from nothing (verified by tests).
- **LEGACY prestige**: restructure for permanent Legacy Points and 10
  permanent upgrade tracks.
- **45 achievements** (including hidden ones), each granting +1% revenue.
- **Offline progression**: chunked simulation (12h base cap, extendable),
  respects bottlenecks and costs, with a welcome-back summary.
- **Statistics**: lifetime analytics, per-business performance, canvas
  charts for revenue/profit/valuation/cash and commodity prices.
- Original procedural **pixel art** (canvas-generated sprites), WebAudio
  sound cues (brew/register/purchase/upgrade/achievement/research/events)
  with volume control and ambient music, responsive desktop-first layout.
- Saves: 30s autosave, save on hide/unload, **JSON export/import**, versioned
  loading with validation and **automatic backup recovery** from corrupted saves.

## Architecture

Plain ordered scripts (no ES modules, so `file://` works). Everything hangs
off a single `CE` namespace with one authoritative state object.

| File | Purpose |
|---|---|
| `src/bignum.js` | Mantissa/exponent big numbers (JSON-safe), formatting, cost math |
| `src/data.js` | Resources, drinks, 48 businesses, staff, regions |
| `src/data2.js` | Upgrades (generated trees + globals + repeatables) |
| `src/data3.js` | Research tree, events, campaigns, competitors, acquisitions |
| `src/data4.js` | Achievements, Legacy upgrades |
| `src/sprites.js` | 16×16 pixel maps → canvas data-URL sprites + palette variants |
| `src/state.js` | State factory, LocalStorage save/load, export/import |
| `src/engine.js` | Centralized 8 Hz simulation + all player actions + offline sim |
| `src/ui.js` | UI core, dashboard, businesses, staff, modals, charts |
| `src/ui2.js` | Production, locations, farms, research sections |
| `src/ui3.js` | Markets, corporate, achievements, statistics sections |
| `src/main.js` | Boot, game loop, autosave, audio |

The engine ticks ~8×/second with elapsed-time deltas; the UI updates at 4 Hz
via targeted DOM writes and only rebuilds a section when its structural
signature (unlocks/achievements/research) changes.

## Tests

Headless Node tests (no browser needed):

```
node test/smoke.js       # economy, chains, brew session, milestones, migration, offline, prestige
node test/ui.js          # all sections render/update + click actions via a DOM shim
node test/progression.js # 40-minute honest bot playthrough
node test/pacing.js      # human-speed early-game unlock cadence
```
