# PRISM — Architecture

Political Risk & Impact Scoring Model. Geopolitical risk and supply-chain
intelligence platform. Zero recurring service costs is the operating target.

## Placement decision (Phase 0)

PRISM lives at `projects/prism/` inside the grettisson monorepo
(github.com/BjarkiGr/grettisson), matching the repository convention of
self-contained project folders. The master specification assumes PRISM is the
repository root; the structure is identical, nested one level down. Render
deploys the static frontend from `projects/prism/frontend`; the Supabase CLI
runs from `projects/prism` (the folder containing `supabase/`).

## Layers

1. **Frontend** — static site: HTML5, CSS3, vanilla ES modules. No build step,
   no framework, no TypeScript. Chart.js and Leaflet.js will load from pinned
   CDN versions (Phase 1). The Supabase JS client loads lazily from a pinned
   CDN ESM import (`js/supabase.js`). Only PUBLIC credentials (Supabase URL +
   anon key, protected by RLS) may appear in frontend code.
2. **Database** — Supabase PostgreSQL + Auth + Row Level Security. Stores
   sources, articles, events, analyses, risk scores, watchlists, jobs.
   Schema is created in Phase 2 via SQL migrations in `supabase/migrations/`.
3. **Backend** — Supabase Edge Functions (TypeScript, Deno). Stateless,
   small-batch, database-backed queues, scheduled via pg_cron + pg_net
   (Phase 7). No permanently running server.

## Data flow (target state)

RSS/public sources -> ingest-sources -> articles (deduplicated) ->
process-articles (classification, event matching) -> analyze-events
(free-tier AI provider, validated structured JSON) -> calculate-risk
(explicit dimension scoring, history preserved) -> frontend reads via
Supabase client under RLS.

## Phase 0 state (honest skeletons)

- Frontend pages are structural skeletons with explicit foundation notices.
  No dashboard, no demonstration data yet (Phase 1).
- `health-check` is functional (status + configuration-presence booleans).
- The four pipeline functions return HTTP 501 `not_implemented` with their
  planned phase. They never pretend to process anything.
- `_shared/` contains real, reusable primitives: CORS/JSON helpers, domain
  types, service-client factory, AI provider interface, validation guards.

## Security boundaries

- Service-role key and AI API keys: Edge Function secrets only.
- Frontend: anon key + RLS; all collected content and AI output treated as
  untrusted and rendered escaped (`js/utils.js`).
- Scheduled invocations authenticate with credentials held in Supabase Vault
  (Phase 7); nothing secret is committed to Git.

## Free-tier constraints

Supabase Free (project may pause after inactivity), Render Static Sites free,
free-tier AI inference only. See DEPLOYMENT.md for limits and recovery, and
AI-INTEGRATION.md for quota handling.

## Phase 1 update

The frontend is now a functional demonstration interface: overview dashboard,
intelligence feed with filters, events list, event detail with transparent
risk breakdown, Leaflet regional map and commodity views — all driven by
js/demo-data.js (fictional, banner + DEMO badges, example.com URLs, no
prices). Chart.js 4.4.4 and Leaflet 1.9.4 load from pinned CDNs with offline
fallbacks. js/components.js holds reusable escaped-HTML components. Page
modules are routed by app.js via body[data-page]. Live data replaces demo
data in Phase 6 without changing the page structure.
