# Godzilla - City Rampage: Action List

Detailed build plan. Items are ticked off once implemented AND verified.

## Phase 0 - Project setup
- [x] Create folder structure (src/, src/entities/, test/)
- [x] index.html with fullscreen canvas + script includes
- [x] style.css (fullscreen, no scrollbars)
- [x] src/util.js shared helpers (rand, pick, clamp, hash)

## Phase 1 - Canvas, loop, movement, camera
- [x] Game loop with clamped delta-time (src/main.js)
- [x] Keyboard input with held + just-pressed detection (src/input.js)
- [x] Godzilla entity with idle/walk states, Arrow/A-D movement
- [x] Smooth-follow camera

## Phase 2 - Procedural city
- [x] Building entity: random size/color, window grid, HP (src/entities/building.js)
- [x] Spawn buildings ahead of camera, cull behind (src/world.js)
- [x] Intact buildings block Godzilla's movement; rubble is walkable

## Phase 3 - Smashing and score
- [x] Attack state machine: windup -> hit frame -> recovery (SPACE / J)
- [x] Building HP: intact -> damaged -> collapsing -> rubble
- [x] Score, smash counter, distance tracking

## Phase 4 - Destruction juice
- [x] Particle system: debris with gravity + ground bounce (src/entities/particle.js)
- [x] Dust clouds on hit and during collapse
- [x] Screen shake: footsteps, hits, collapses
- [x] Visible damage: broken windows + crack lines

## Phase 5 - Art and animation (procedural vector, zero assets)
- [x] Godzilla: body, swaying tail, dorsal plates, head/jaw, claws
- [x] Walk cycle (leg swing + body bob), attack swipe, roar pose
- [x] Building details: roof props, lit windows, deterministic rubble piles
- [x] Dusk sky gradient, moon, road with lane markings

## Phase 6 - Sound and UI
- [x] Web Audio SFX synthesized in code: stomp, whoosh, hit, crumble, roar (src/audio.js)
- [x] Mute toggle (M)
- [x] Title screen (ENTER to start, also unlocks audio)
- [x] HUD: score / smashed / distance / controls hint

## Phase 7 - Polish pass
- [x] Parallax: 2 skyline layers + drifting clouds
- [x] Combo system: multiplier, 3s decay timer, HUD bar
- [x] Floating score popups (+10 / +100 x combo / COMBO xN)
- [x] Roar (R): screen shake + nearby building windows flicker

## Phase 8 - Validation
- [x] Syntax-check every JS file (node --check)
- [x] Headless smoke test: boot, start, walk, smash, roar, combo, score (test/smoke.js)
- [x] Final review of all files

## Phase 9 - Auto-walk, jump and atomic breath
- [x] Auto-walk forward; LEFT/A brake, RIGHT/D sprint (src/entities/godzilla.js)
- [x] Jump (UP/W) with gravity; landing shockwave damages nearby buildings
- [x] Airborne SPACE = body slam (fast fall + bigger shockwave)
- [x] Pink atomic beam (hold F/K): 700px piercing ray, damage ticks
- [x] Beam energy meter: drains while firing, regen + bonus per smash
- [x] Pink dorsal-plate glow, beam core/halo rendering, sparks, synth SFX

## Phase 10 - Swim sections
- [x] World segments: 100m city / 50m water at 50px = 1m (src/world.js)
- [x] Buildings only in city stretches; water gradient, waves, moon glints
- [x] Swimming: auto-forward, UP/DOWN depth control, submerged rendering
- [x] Navy boats (src/entities/boat.js): arcing shells, dive to dodge
- [x] Shell hit: -150 pts, combo reset, brief stun; swipe disabled in water
- [x] Beam-only combat vs boats (+300 per kill), splash/bubble particles

## Phase 11 - Daily Rampage (score attack, no backend)
- [x] Seeded RNG: date string -> xmur3 -> mulberry32 (src/util.js setSeed)
- [x] All gameplay randomness seeded; cosmetic randomness isolated (crand)
- [x] Daily: fixed 500m course (4 city + 3 swim), finish line, time bonus
- [x] One scored run/day; streaks + history + unlimited best in localStorage (src/daily.js)
- [x] Title screen mode select: ENTER daily / U unlimited; results screen
- [x] Wordle-style emoji share grid copied to clipboard (C or click)

## Phase 12 - Validation (expansion)
- [x] Syntax-check every JS file (node --check)
- [x] Smoke test: auto-walk, brake, jump, beam, swim, dive, boats, daily
      finish, share copy, streak, unlimited, one-run-per-day (test/smoke.js)
- [x] Determinism check: same date seed => identical city + boat layout

## Phase 13 - Mobile / touch
- [x] Synthetic key press/release in Input; touch buttons reuse keyboard mappings (src/input.js)
- [x] DOM touch controls on coarse-pointer devices: brake/sprint, smash/jump/beam/roar, dive/up in water, mute + end run (src/touch.js)
- [x] Menu buttons synced to title/results screens; held keys released on screen change
- [x] Audio unlock inside the touch gesture (iOS requirement)
- [x] DPR-aware canvas backing store (capped at 2) for crisp rendering (src/main.js)
- [x] Scaled world view on small screens (~900x540 logical minimum), compact HUD, touch-aware menu text, portrait rotate hint (src/game.js)
- [x] Safe-area aware button layout, no zoom/scroll/selection (style.css, index.html viewport)
- [x] Smoke test: touch buttons drive gameplay, water swap, menus, key cleanup, DPR + phone resize (test/smoke.js)

## Phase 14 - Daily beam tuning
- [x] Tunable beam params on Godzilla (beamDrain / beamRegen / roarRecharge); defaults = unlimited (src/entities/godzilla.js)
- [x] Daily only: beam drains 40/s (vs 26), roar recharges +35 energy, capped at 100 (src/game.js resetRun)
- [x] Recharge feedback: +ENERGY popup, energy-bar flash, daily-only 'R roar (+energy)' hint (src/game.js)
- [x] Smoke test: daily drain/recharge + cap, unlimited defaults untouched (test/smoke.js)

## How to run
Open index.html in a browser (no server or build step needed),
or serve the folder: `npx serve .` / `python -m http.server`.
Run the smoke test: `node test/smoke.js`
