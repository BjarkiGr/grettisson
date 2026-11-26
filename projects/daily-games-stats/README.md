# daily-games-stats — Daily Games Stats stigatafla

Static leaderboard for six daily games: [Size It Up](https://magnitudle.com/size-it-up),
[Skuggabaldur](https://skuggabaldur.is), [Krillion](https://krillion.io),
[Verðlengjan](https://grettisson.is/projects/verdlengjan/) (our own Krónan price guesser),
[TimeGuessr](https://timeguessr.com) and [Farflung](https://farflung.game).
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
- `supabase-migration-verdlengjan.sql` — adds Verðlengjan to an existing multi-game setup
- `supabase-migration-krillion-max.sql` — sets Krillion's max score to 700
- `supabase-migration-timeguessr-farflung.sql` — adds TimeGuessr and Farflung to an existing setup
- `supabase-migration-verdlengjan-traffic.sql` — anonymous Verðlengjan traffic
  counting (`verd_track` / `verd_traffic`) for the participation panel
- `supabase-migration-feedback.sql` — feedback box ("Senda inn ábendingu")
  and the admin-only "💡 Ábendingar" tab
- `supabase-migration-admin.sql` — makes Bjarki admin + adds admin functions
- `test/smoke.mjs` — syntax, wiring and share-text parser checks (`node test/smoke.mjs`)

## Setup (one time, ~5 minutes)

1. Create a free account at <https://supabase.com> and click **New project**
   (any name/region, generate a database password — you will not need it again).
2. Open **SQL Editor** in the project dashboard, paste the entire contents of
   `supabase-setup.sql` and press **Run**. (Already ran the older single-game
   version? Run the `supabase-migration-*.sql` files in order instead — they
   upgrade in place and keep all existing scores.)
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
| 🦐 Krillion | 700 | `Krillion #128 🦐` + score line + sea grid |
| 🥐 Verðlengjan | 102 cm (+5 Thursday) | `🥐 Verðlengjan #3 — 74 cm` + tier row |
| 🕰️ TimeGuessr | 50,000 | `TimeGuessr #1275 — 42,390/50,000` + 5 round lines |
| 🧭 Farflung | 500 km (lower is better) | `Farflung #53 · 265/500 km` + rarity row |

The paste box auto-detects the game from the share text.
Farflung scores are total kilometres off target — **lower is better**, so its
standings, averages and "best" are ranked ascending (unlike the other games).
TimeGuessr share texts use comma thousands separators (`42,390`) — the parser
strips them, and the per-round 🏆 scores are kept as rounds.
Verðlengjan scores are pastry centimetres; Thursdays allow up to 107 cm.
Logged-in users also see a "Þátttaka í Verðlengjunni" panel on the 🥐 tab:
**total traffic** per day — how many people visited the game and how many
completed the daily puzzle (anonymous counting in the game itself, one visit
per browser per day). Run `supabase-migration-verdlengjan-traffic.sql` once
to enable it; until then the panel falls back to counting submitted scores.
Verðlengjan can also submit directly from the game ("Senda á stigatöfluna 🏆"
on the results screen) — same account/PIN, same `submit_score` function,
so pasted and auto-submitted scores are identical.

## Admin

The player `Bjarki` is admin (👑 next to the name). Clicking any player opens
their history modal, where admins get extra controls:

- 🗑 delete a single score (per game/puzzle)
- 🔑 reset a player's PIN (for friends who forget it)
- 🗑 delete a player entirely, including all their scores (not yourself)

Every admin action is verified **server-side** (PIN + `is_admin` flag) — the
buttons are just convenience; crafted requests from non-admins are rejected.
To make someone else admin, run in the SQL Editor:

```sql
update players set is_admin = true where lower(name) = 'nafn';
```

## Feedback (ábendingar)

Anyone can click **"💡 Senda inn ábendingu"** at the bottom of the page and
send a suggestion (anonymously, or under their logged-in name). Admins see a
**"💡 Ábendingar"** tab next to the view modes with all feedback (newest
first) and a 🗑 delete button per item. Run
`supabase-migration-feedback.sql` once to enable it.

Security: parameterized plpgsql only (no SQL string concatenation — injection
safe), RLS blocks direct table access, reading/deleting verifies PIN +
`is_admin` server-side, messages are limited to 1–2000 chars with casual rate
limits (3 per name/hour, 30 total/hour), and all text is HTML-escaped when
rendered (XSS safe).

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
