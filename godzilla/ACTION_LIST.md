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

## How to run
Open index.html in a browser (no server or build step needed),
or serve the folder: `npx serve .` / `python -m http.server`.
Run the smoke test: `node test/smoke.js`
