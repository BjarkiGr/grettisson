# Verðlengjan 🥐 — hvað kostar dæmið?

Daily Krónan price guesser for grettisson.is. Five products a day (same for
everyone), aim with the logarithmic price slider (±1/±10 fine-tune buttons),
and each answer bakes a 16-bit pixel-art slice onto your vínarbrauðslengja.
Exact price = max growth; more than 100% off = no growth at all:

| Tier | Accuracy | cm |
|---|---|---|
| 🎯 Á nagann! | exact price | 20 |
| 🟩 Mjög nálægt | ±5% | 16 |
| 🟨 Nálægt | ±15% | 12 |
| 🟧 Sæmilegt | ±35% | 8 |
| 🟥 Fjarri lagi | ±100% | 4 |
| ⬛ Ekkert! | >100% off | 0 |

Everyone starts with the 2 cm endinn. 100 cm = Metralengjan 🏆. Thursdays add
a free 5 cm fimmtudagssneið. One scored run per day (localStorage), unlimited
mode, streaks, Wordle-style emoji sharing. No backend — fully static.

## Data pipeline (run locally, never ships)

Prices come from a snapshot of kronan.is, pinned to `snapshotDate` so puzzles
stay fair when prices change. Re-run every month or so:

```
node tools/fetch-products.mjs          # no token: scrapes public JSON-LD
node tools/curate.mjs                  # flags fun wildcards, drops duplicates
node test/smoke.js && node test/dom-smoke.js
```

With a Krónan API token (kronan.is settings, Auðkenni login) you can pull the
full catalog instead of the ~200 public catalog products:

```
$env:KRONAN_TOKEN = "..."              # PowerShell
node tools/fetch-products.mjs --api
node tools/curate.mjs
```

The token stays on your machine — it is never written into the site.
After refreshing, review `data/products.json` (fun flags, junk) and re-run tests.

## Tests

- `node test/smoke.js` — scoring bands, seeded daily-five determinism, cm math,
  persistence, streaks, share format (against the real bank).
- `node test/dom-smoke.js` — boots the real game with a stub DOM and plays full
  daily + unlimited rounds through the UI wiring.
- `node tools/check-wiring.mjs` — every referenced element ID / script exists.

## Credits

Prices and product images: Krónan (kronan.is), via their public catalog /
public API. This is a fan project, not affiliated with Krónan.
