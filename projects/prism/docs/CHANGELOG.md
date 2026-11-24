# PRISM — Changelog

## [Unreleased] — Phase 7: Automation

### Added
- Migration 20261126000000_automation.sql: pg_cron + pg_net, cron_runs
  history (RLS), Vault-backed overlap-guarded invoker (whitelisted,
  anon-revoked), response reaper with stale-timeout + cleanup,
  prism_automation_status(), six idempotent schedules.
- health-check reports automation status (vault configured, job count,
  recent runs) via rpc; phase marker 7.
- docs/AUTOMATION.md; test/phase7-smoke.mjs (28 checks).

### Verified
- phase7-smoke 28/28; health-check redeployed.

### Fixed
- pg_net default 5s timeout marked successful invocations as failed (the
  Edge Functions kept running server-side). invoker now uses
  timeout_milliseconds := 120000; status function exposes response excerpts.

### Verified (live, autonomous)
- Migration applied; Vault secret created (vault_configured=true, 6 jobs).
- 22:30 tick ingested 9 new articles autonomously (121 -> 130).
- 22:45 tick: process-articles + analyze-events completed HTTP 200;
  events 25 -> 27, analyses 25 -> 27, 182 jobs completed, 0 failures.
- Full loop proven: cron -> Vault -> invoke -> function -> pg_net response
  -> reaper -> cron_runs history. Remaining risk jobs score at the hourly
  tick. Phase 7 complete.
## Phase 6: Dashboard Integration

### Added
- js/data.js: live intelligence layer — parallel Supabase fetches under the
  admin session (RLS), pure composition (latest score + history + analysis
  per event), weekly activity derivation, watchlist matching, related
  events, commodity index, region score-history trends.
- js/geo.js: reference coordinates (factual geography, not intelligence).
- js/watchlists.js + watchlists.html: real CRUD (owner-only RLS), matched
  events per entry, explicitly linked events; event-detail linking UI.
- Auth gate in app.js: every page except login redirects signed-out
  visitors to login.html; sign-out redirects too; post-login redirect home.
- test/phase6-smoke.mjs: 48 checks (composition, activity, trends, matching,
  null-score safety, auth-gate wiring, no demo imports in production).

### Changed
- All pages now render LIVE intelligence: overview stats/charts/feed/supply
  chains, events list + filters, event detail (assessment provenance, risk
  breakdown, history, related, watchlist link), regional map + summaries +
  trends, commodities from real analyses. Demo banners removed; DEMO badges
  only render for items explicitly flagged demo (none in production).
- demo-data.js retained as a TEST FIXTURE ONLY (not imported by pages).
- utils.riskLevelFromScore rejects null/undefined (unscored events show a
  dash, never a false MINIMAL).
- grettisson homepage PRISM card reduced to just "PRISM" (user request).

### Verified
- 7 suites: 245+168+73+45+36+49+48 = 664 checks, 0 failures.
- HTTP serve: 22/22 resources 200 OK.

### Verified (administrator, in browser)
- Auth gate redirects signed-out visitors to login.html.
- Dashboard renders live intelligence (25 events, 121 articles, real charts).
- Watchlist CRUD and event linking work.
- Homepage card reduced to "PRISM" only. Phase 6 complete.
## Phase 5: Risk Scoring

### Added
- _shared/risk.ts: finalized methodology — deterministic dimension
  derivation from validated analyses (severity anchors, verified-fact
  probability ratio, country-count reach, category duration priors,
  commodity/industry exposure), weighted formula, generated explanations.
- calculate-risk function: batches of 10, atomic claims, latest-analysis
  selection, append-only risk_scores inserts with confidence, bounded
  retries.
- test/phase5-smoke.mjs: 49 checks incl. frontend/backend weight + formula
  + band parity.

### Verified (live)
- All 25 queued events scored: range 42-77, median 55, 0 failures.
- Full pipeline queue drained: 171 jobs completed, 0 pending/failed/paused.
- RISK-METHODOLOGY.md finalized with anchored scales and derivation rules.
## Phase 4: AI Integration

### Added
- ai-provider.ts: concrete OpenAI-compatible provider (Groq / Gemini compat /
  OpenRouter free models), injectable fetch, JSON mode with fallback,
  precise error taxonomy (rate_limited w/ Retry-After, quota_exhausted,
  auth, timeout, invalid_response, unavailable).
- prompts.ts: versioned prompt 1.0.0 — 16-field JSON schema, evidence
  standards (verified_fact/inference/speculation), no-invented-citations
  rule, severity anchors, confidence distinct from impact.
- analysis-validation.ts: strict validation; fabricated citations rejected
  (source_references subset of provided URLs; evidence ids must exist).
- analyze-events function: batches of 3, atomic claims, provenance stored
  (provider/model/prompt_version), event refinement, calculate_risk
  queueing, pause-on-quota with auto-resume (10 min rate / 60 min quota)
  and manual resume, bounded retries, honest 503 when unconfigured.
- health-check: real DB activity stats (table counts, jobs by status,
  recent failed jobs, last ingestion time).
- test/phase4-smoke.mjs: 36 checks (validation incl. fabricated-citation
  rejection, prompts, provider error mapping with stubbed fetch).

### Verified
- Deployed analyze-events + health-check. Unconfigured state returns honest
  503; health-check reports 121 articles / 25 events / 25 pending analysis
  jobs / 0 failures. Regression: 240+168+73+45+36 — 0 failures.

### Verified (live, Groq free tier)
- Provider configured via supabase secrets (groq / openai/gpt-oss-120b).
  llama-3.3-70b-versatile was retired (HTTP 404); model list queried and
  AI_MODEL updated — provider error messages now include response bodies.
- All 25 queued events analyzed: 25 analyses stored with provenance,
  0 rejected outputs, 0 failed jobs. Rate limits hit during draining were
  handled automatically: pause -> 65s backoff -> resume -> continue.
- 25 calculate_risk jobs queued and waiting for Phase 5.
- health-check gained recent_job_errors for monitoring.

### Security note
- The Groq API key was pasted into chat during setup; it should be ROTATED
  (Groq console -> revoke -> new key -> supabase secrets set AI_API_KEY=...).
## Phase 3: Information Ingestion

### Added
- _shared/rss.ts: dependency-free RSS 2.0 / RSS 1.0 (RDF) / Atom parser
  (CDATA, entities, HTML-stripped excerpts, date normalization).
- _shared/normalize.ts: URL normalization (tracking params, fragments,
  host casing, default ports, trailing slashes, sorted params) + SHA-256
  content hashing for deduplication.
- _shared/classify.ts: transparent keyword classifier — 12 categories,
  ~110 country names -> ISO codes -> regions, plural-aware word-boundary
  matching, title hits weighted double. No AI involved.
- ingest-sources function: <=8 sources and <=25 items per feed per run,
  10s fetch timeouts, per-source error isolation, content_hash dedup via
  upsert-ignore, process_article job queueing, last_checked_at updates,
  honest per-source stats in the response.
- process-articles function: atomic job claims (overlap-safe), bounded
  retries (3 attempts), irrelevant filtering, event matching (category +
  country + 14-day window) or clearly-labeled PROVISIONAL event creation,
  event_articles linking, analyze_event queueing for Phase 4.
- Migration 20261125000000_seed_sources.sql: 6 real public syndication
  feeds (BBC, Al Jazeera, DW, Guardian, NPR, UN News), idempotent.
- test/phase3-smoke.mjs (45 checks) + test/phase3-feeds.mjs (live feed
  verification, 6/6 feeds parseable).

### Verified
- All six seeded feeds fetched live and parsed with the production parser
  (152 items total, all links normalizable).
- Full regression: foundation 238, phase1 168, phase2 73, phase3 45 — 0 fail.

### Verified (live, production project)
- Functions deployed via `npx supabase functions deploy ... --use-api --yes`
  (server-side bundling, no Docker). Seed migration applied via SQL Editor.
- First ingestion: 6 sources, 121 real articles inserted, 0 source errors.
- Processing: 121 jobs completed — 84 irrelevant, 25 provisional events
  created, 12 articles matched to existing events, 0 retries, 0 failures.
- Idempotency: second ingestion inserted 0, skipped 121 duplicates; queue
  drained (processed=0). analyze_event jobs queued and waiting for Phase 4.
- health-check updated to Phase 3 and redeployed.
- Runbook corrected: SQL Editor + --project-ref/--use-api path; db push
  without link targets the local stack (ECONNREFUSED) and is avoided.
## Phase 2: Database & Authentication

### Added
- Migration 20261124000000_initial_schema.sql: all 10 tables, 4 enums,
  UUID keys, FKs, check constraints, indexes, unique constraints
  (content_hash, feed_url, watchlist targets, active-job dedup),
  updated_at triggers, auto-profile trigger, full RLS (authenticated-read
  intelligence, owner-only private data, service-role-only writes,
  append-only risk_scores, backend-only processing_jobs). Idempotent.
- auth.js: real Supabase email/password sign-in, sign-out, session and
  auth-state subscription; login page wiring with loading/error states.
- login.html: functional administrator sign-in form (disabled honestly
  until config.js is filled).
- settings.js + settings.html connection panel: real per-table read tests
  under RLS, session display, sign-out.
- Footer session indicator on all pages (app.js).
- test/phase2-smoke.mjs: 68 checks (schema, RLS policies, module exports,
  page wiring, secret scans).

### Changed
- app.js routes login/settings; DATABASE.md/DEPLOYMENT.md updated with the
  implemented access model and the Phase 2 dashboard runbook.

### Pending (manual)
- Apply migration in SQL Editor; disable sign-ups; create admin user;
  fill config.js with the project URL + anon key; live verification.
## Phase 1: Frontend Development

### Added
- Demonstration data module (js/demo-data.js): 9 fictional scenarios, 16
  fictional articles, 6 invented sources, 6 commodities, weekly activity and
  regional trend series. All items flagged demo; URLs use example.com; no
  market prices; overall scores computed from dimensions, never hand-written.
- Reusable components (js/components.js): risk badges, DEMO badges, stat
  cards, event rows, feed items, dimension bars, tables, loading/empty/error
  states. All dynamic values HTML-escaped.
- Overview dashboard: stat cards, highest-risk events, regional distribution
  (bar), activity over time (line), commodity exposure (doughnut), recent
  risk changes, source activity, Intelligence Feed with search + 3 filters,
  Supply Chains section.
- Events page: search + category/region/risk filters, sorted by score.
- Event detail: summary, timeline, simulated assessment (clearly marked, no
  AI called), transparent 6-dimension risk breakdown with confidence,
  consequences, supporting articles, related events, score-history chart.
- Regional Risk: Leaflet 1.9.4 world map (OSM tiles, attribution) with risk
  markers, regional summaries, historical trend chart.
- Commodities: per-commodity cards with linked developments and disruption
  notes; explicit no-prices policy.
- Charts via pinned Chart.js 4.4.4 CDN ESM; Leaflet via pinned unpkg; both
  with honest offline fallbacks. Accessible mobile nav toggle. Page routing
  via body[data-page] in app.js. Persistent demonstration-data banner.
- test/phase1-smoke.mjs: 167 checks (data integrity, referential integrity,
  score calculation, filters, aggregation, XSS escaping, page wiring).

### Changed
- All 8 HTML pages regenerated with the Phase 1 shell; login/watchlists/
  settings remain honest skeletons for Phases 2/6.
- utils.js: added formatDate, riskClass, RISK_COLORS, RISK_WEIGHTS,
  computeOverallScore, getQueryParam, debounce.
- components.css / dashboard.css / responsive.css expanded for the new
  layouts; mobile navigation collapses behind a Menu button.

### Decisions
- js/components.js added (spec requires reusable components; no file named).
- Intelligence Feed and Supply Chains are sections of the Overview page
  (anchor targets), matching the spec file list; may become pages later.
- Demo scoring uses the proposed RISK-METHODOLOGY weights; finalized in
  Phase 5.
## Phase 0: Project Foundation

### Added
- Project structure at projects/prism/ (frontend, supabase, docs, test).
- Frontend skeletons: 8 semantic HTML pages with explicit foundation
  notices, dark-first design tokens, app-shell layout, responsive rules.
- Frontend modules: config.js (public config + isConfigured), supabase.js
  (lazy pinned-CDN client loader), app.js (configuration status), utils.js
  (escapeHtml, formatDateTime, riskLevelFromScore); labeled stubs for the
  remaining page modules (no placeholder functionality).
- Supabase: config.toml, empty migrations folder (Phase 2), _shared
  modules (cors, types, database, ai-provider interface, validation),
  functional health-check, honest 501 skeletons for the four pipeline
  functions.
- Documentation: ARCHITECTURE, DATABASE, AI-INTEGRATION, RISK-METHODOLOGY,
  DEPLOYMENT, CHANGELOG; project README.
- Environment templates (.env.example, supabase/functions/.env.example)
  and project .gitignore. No real credentials anywhere.
- Foundation smoke test (test/foundation-smoke.mjs, Node, zero deps).
- PRISM card on the grettisson homepage (marked in development).

### Decisions
- PRISM placed inside the grettisson monorepo at projects/prism/ (approved
  by user); spec structure preserved one level down.
- No dependencies installed; Supabase JS via pinned CDN ESM import.
