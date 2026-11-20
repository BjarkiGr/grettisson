# fossberg-stats — Fossberg Stats stigatafla

Static leaderboard for three daily games: [Size It Up](https://magnitudle.com/size-it-up),
[Skuggabaldur](https://skuggabaldur.is) and [Krillion](https://krillion.io).
Register with a name + 4-digit PIN, paste your Share text (the game is
detected automatically), and compare
scores with friends (daily standings + overall averages).

This is a static-site port of the original single-file PHP app
(`gemini-code-1795177116462.php`, kept for reference). The PHP backend was
replaced with a free **Supabase** project, so the site runs on GitHub Pages
with no server and no database to manage.

## Files

- `index.html`, `style.css`, `script.js` — the static frontend
- `supabase-setup.sql` — one-time backend setup (tables, security, API functions)
- `supabase-migration-games.sql` — upgrades an older single-game setup to multi-game
- `test/smoke.mjs` — syntax, wiring and share-text parser checks (`node test/smoke.mjs`)

## Setup (one time, ~5 minutes)

1. Create a free account at <https://supabase.com> and click **New project**
   (any name/region, generate a database password — you will not need it again).
2. Open **SQL Editor** in the project dashboard, paste the entire contents of
   `supabase-setup.sql` and press **Run**. (Already ran the older single-game
   version? Run `supabase-migration-games.sql` instead — it upgrades in place
   and keeps all existing scores.)
3. Collect these two values (they live on different pages in the dashboard):
   - the **Project URL** (`https://<project-ref>.supabase.co`). The API Keys
     page does NOT show it — use the **Connect** button at the top of the
     dashboard (shows URL + key together), or **Integrations → Data API**.
     Shortcut: take the project ref from your dashboard's address bar
     (`supabase.com/dashboard/project/<project-ref>`) and wrap it:
     `https://<project-ref>.supabase.co`.
   - the **Publishable key** (`sb_publishable_...`) from **Project Settings →
     API Keys**. If your project shows the
     older layout instead, use the **anon / public** key from the
     "Legacy API keys" tab — it works exactly the same way.

   ⚠️ Never use the **Secret key** (`sb_secret_...`, formerly `service_role`)
   in the frontend — it bypasses all security and is visible to anyone who
   views the page source.
4. Paste them into the two constants at the top of `script.js`:
   `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
5. Open `index.html` (e.g. with VS Code Live Server) or push to GitHub Pages.
   Done — everyone visiting the site shares the same leaderboard.

Until step 4 is done the page shows a setup notice instead of the table.

## Games

| Game | Max score | Share format |
|---|---|---|
| 📏 Size It Up | 500 | `#103` + `Score: 314/500` + square grid |
| 🌑 Skuggabaldur | 700 | `Skuggabaldur #37 🌑 380/700` + animal grid |
| 🦐 Krillion | no fixed max | `Krillion #128 🦐` + score line + sea grid |

The paste box auto-detects the game from the share text. Krillion has no
fixed maximum, so its score bars are scaled against the current top score.

## Security notes

- The **publishable / anon key is designed to be public**. RLS blocks all
  direct table access; the key can only call the four API functions.
- PINs are bcrypt-hashed inside Postgres (pgcrypto), exactly like
  `password_hash` in the PHP version. Hashes are never sent to the browser.
- Each player can have one score per puzzle; re-submitting overwrites it.
- A 4-digit PIN is casual protection between friends, not bank-grade security
  (same as the original app).

## Good to know

- Supabase free projects pause after ~1 week without any traffic. If the table
  stops loading, open the dashboard and press **Restore** — daily use keeps it
  awake automatically (the page polls every 30 seconds while open).
- Scores and players can be inspected/edited in the Supabase **Table editor**.
