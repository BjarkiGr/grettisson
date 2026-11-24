# PRISM — Review Brief (for an AI or human reviewer)

Plain-text description of the implementing agent's role and the system as
built, followed by a review checklist. Hand this file + the repository to
any capable AI reviewer and ask it to critique the implementation against
the checklist and the master specification.

## The agent's role (plain text)

I acted as the sole implementation engineer for PRISM across Phases 0-8,
working inside the grettisson monorepo under a fixed master specification.
My responsibilities: inspect before changing; implement only the authorized
phase; keep the frontend pure vanilla JS (no build step); keep TypeScript
only in Supabase Edge Functions; never introduce paid services, Python or
Docker; never invent credentials or fabricate intelligence data; test every
phase; report and stop for approval between phases. Architectural decisions
were explained and (where structural) approved by the user, e.g. placing
PRISM at projects/prism/ inside the monorepo.

## What was built (summary)

- Static frontend (8 pages) behind an admin login gate; live data via the
  Supabase JS client (pinned CDN); Chart.js + Leaflet from pinned CDNs with
  offline fallbacks; region selector (Global/Iceland) persisted locally.
- PostgreSQL schema (10 tables + cron_runs), RLS everywhere, explicit
  GRANTs (anon: none; authenticated: read intelligence + own private rows;
  service_role: full). risk_scores append-only.
- Five Edge Functions: ingest-sources (RSS parse/normalize/dedup/queue),
  process-articles (keyword classification incl. Icelandic stems, event
  matching/creation), analyze-events (free-tier Groq, strict JSON
  validation, fabricated-citation rejection, quota pause/auto-resume),
  calculate-risk (deterministic dimension derivation + weighted formula),
  health-check (activity + automation status).
- Automation: pg_cron + pg_net, Vault-held service key, overlap guard,
  cron_runs history, response reaper with stale timeout.
- 9 test suites (~720 checks), zero installed dependencies.

## Known limitations (self-declared)

1. Single-admin MVP; no multi-user isolation testing beyond RLS policies.
2. Keyword classifier is a cheap first pass; Icelandic coverage is
   stem-limited; misclassification possible (AI refines categories later).
3. Risk derivation rules (count-based exposure, category duration priors)
   are simple heuristics, documented but not empirically validated.
4. Probability dimension derives from verified-fact evidence ratio — a
   proxy, clearly labeled an estimate, not a statistic.
5. RSS excerpts only; no full-text scraping (licensing-safe but shallow).
6. localStorage region preference (not synced to profiles yet).
7. Free-tier AI quotas can pause analysis; auto-resume windows are fixed.
8. Supabase free project may pause after inactivity; cron stops until
   restored via dashboard.
9. No rate limiting on the login form beyond Supabase Auth defaults.
10. Demo fixture module remains in the repo (test-only, not imported).

## Reviewer checklist — what to look out for

- RLS: any table readable/writable by anon? Any policy using (true) for
  writes? Owner checks on watchlists/event_watchlists/profiles correct?
- Secrets: service key or AI key anywhere in Git, frontend, logs, or
  function responses? Vault access restricted to definer functions?
- XSS: every dynamic string escaped before innerHTML? Map popups, feed
  items, event titles, watchlist names, error messages included?
- Injection: SQL built only via migrations/parameterized client calls?
  cron invoker whitelist bypassable? URL normalization open to abuse?
- Idempotency/overlap: duplicate articles on re-ingest? Double scoring?
  Cron overlap guard effective? Job claim races?
- AI integrity: can malformed or fabricated-citation output reach the
  analyses table? Is the final score ever AI-generated? Prompt injection
  via article content — what stops an article telling the model to ignore
  instructions, and does validation contain the blast radius?
- Quota/failure behavior: does anything auto-upgrade to paid? Do pauses
  resume? Are failures recorded honestly?
- Scoring: weights/bands identical frontend vs backend? Explanations
  reproducible from stored inputs? Confidence distinct from impact?
- Licensing: only syndication-permitted feeds? Excerpts + links, no
  full-text republication? Attribution present (OSM, sources)?
- Free-tier sustainability: invocation/storage growth bounded? Pruning?
- Deployment: static site truly build-free? CDN pinning + fallbacks?
  Backup/restore procedure actually executable on the free tier?

## Self-review performed (Phase 8)

The implementing agent re-ran all suites, re-verified anon denial live,
confirmed secret scans clean before each push, and checked the checklist
above against the code. Findings: no anon access; no secrets in Git;
escaping centralized in components/utils; invoker whitelisted; prompt
injection blast radius contained by strict schema + citation validation
(worst case: a rejected or low-quality analysis, never arbitrary writes).
Residual risks are the self-declared limitations above.
