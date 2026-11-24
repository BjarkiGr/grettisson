# Verðlengjan 🥐 — hvað kostar dæmið?

Daily Krónan price guesser for grettisson.is, in dark mode. A start screen
("Búa til vínarbrauð dagsins!") kicks off five products a day (same for
everyone). Aim with the logarithmic price slider (±1/±10 fine-tune buttons),
and each answer grows your seamless 16-bit vínarbrauðslengja — one pastry,
always fully visible on a fixed 0-100 cm scale (no scrolling, no flags).
Same look along the whole length: chocolate + pink frosting on top, a
yellow custard line in the middle, toasted almonds on the brown crust
below. Exact price = max growth;
more than 100% off = no growth at all:

| Tier | Accuracy | cm |
|---|---|---|
| 🎯 Rétt verð! | exact price | 20 |
| 🟩 Mjög nálægt | ±5% | 16 |
| 🟨 Nálægt | ±15% | 12 |
| 🟧 Sæmilegt | ±35% | 8 |
| 🟥 Fjarri lagi | ±100% | 4 |
| ⬛ Ekkert! | >100% off | 0 |

Everyone starts with the 2 cm endinn. 100 cm = Metralengjan 🏆. Thursdays add
a free 5 cm fimmtudagssneið. One scored run per day (localStorage), unlimited
mode, Wordle-style emoji sharing. Type prices in directly (or use the slider),
browse your baking history and streaks under 📊, see price changes from
older snapshots after each reveal, and submit to the shared
[Daily Games Stats](../daily-games-stats/) leaderboard with one click
(same name + PIN account; Supabase, no backend of our own). Fully static.

## Data pipeline

Prices come from a snapshot of kronan.is, pinned to `snapshotDate` so puzzles
stay fair when prices change. The game loads the bank that was effective for
today's date (`data/manifest.json` + `data/banks/` archives), so a refresh
never changes an ongoing puzzle, and older snapshots feed the price-history
row in the reveal phase.

**Automated (recommended):** the GitHub Actions workflow
`.github/workflows/refresh-verdlengjan.yml` runs weekly (Mondays 06:00 UTC,
plus manual dispatch) and opens a PR with a refreshed bank:

1. `node tools/archive-bank.mjs` — archive current bank + update manifest
2. `node tools/fetch-products.mjs --api` — full catalog via the official API
3. `node tools/curate.mjs` — flag fun wildcards, drop duplicates
4. `node tools/build-history.mjs` — rebuild `data/price-history.json`
5. `node test/smoke.js && node test/dom-smoke.js && node tools/check-wiring.mjs`

One-time setup: create a Krónan API token (kronan.is settings, Auðkenni
login) and add it as the **`KRONAN_TOKEN` repository secret** on GitHub.
The token never ships to the site. Review the PR (fun flags, junk, price
buckets) before merging.

**Manual refresh** (still works, run locally):

```
node tools/archive-bank.mjs            # keep the old bank for older dates
node tools/fetch-products.mjs          # no token: scrapes public JSON-LD
node tools/curate.mjs
node tools/build-history.mjs
node test/smoke.js && node test/dom-smoke.js
```

The no-token scrape harvests product links from the front page plus every
public landing page in the server sitemap (~700 products, evenly sampled
with `--limit N`). With a token you can pull the full catalog instead:

```
$env:KRONAN_TOKEN = "..."              # PowerShell
node tools/fetch-products.mjs --api
```

The token stays on your machine — it is never written into the site.

## Tests

- `node test/smoke.js` — scoring bands, seeded daily-five determinism, cm math,
  persistence, streaks, share format (against the real bank).
- `node test/dom-smoke.js` — boots the real game with a stub DOM, clicks through
  the start screen and plays full daily + unlimited rounds (Thursday-aware).
- `node tools/check-wiring.mjs` — every referenced element ID / script exists.

## Credits

Prices and product images: Krónan (kronan.is), via their public catalog /
public API. This is a fan project, not affiliated with Krónan.