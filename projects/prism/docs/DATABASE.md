# PRISM — Database (implemented in Phase 2)

Supabase PostgreSQL. UUID primary keys, foreign keys, indexes, unique
constraints, timestamps and RLS on all tables.

Migration: `supabase/migrations/20261124000000_initial_schema.sql`
(idempotent — safe to re-run). Apply via the Supabase SQL Editor or
`supabase db push`. See DEPLOYMENT.md for the Phase 2 runbook.

## Tables (spec section 11)

| Table | Purpose | Key constraints (planned) |
|---|---|---|
| profiles | User info/preferences + role (admin/viewer) | FK -> auth.users; owner-only RLS; column-level update grant blocks role self-promotion |
| sources | Registered public information sources | unique(feed_url); active flag |
| articles | Collected article metadata + available text | unique(content_hash); index on (source_id, published_at); processing_status |
| events | Identified developments (not raw articles) | category enum (12 values); index on (primary_country, region) |
| event_articles | Many-to-many events <-> articles | unique(event_id, article_id) |
| analyses | AI assessments with provenance | provider, model, prompt_version, analysis_json (jsonb), confidence |
| risk_scores | Historical dimension + overall scores | append-only history per event; overall 0-100 |
| watchlists | User monitoring preferences | owner-only RLS |
| event_watchlists | events <-> watchlists | unique(event_id, watchlist_id) |
| processing_jobs | Database-backed queue | job_type, status, attempts, last_error; index on (status, job_type) |

## Access model (implemented)

- Intelligence (sources, articles, events, event_articles, analyses,
  risk_scores): SELECT for authenticated users only (single-admin MVP).
  anon role sees nothing. All writes: service role (Edge Functions) only.
- risk_scores: append-only — no update/delete policies exist.
- processing_jobs: RLS enabled with zero policies — backend only.
- profiles: owner-only select/update; rows auto-created by a SECURITY
  DEFINER trigger on auth.users insert.
- Private: profiles, watchlists, event_watchlists — owner-only.
- Writes to intelligence tables: service-role (Edge Functions) only.
- processing_jobs: backend-only.

Domain TypeScript shapes mirroring these tables already exist in
`supabase/functions/_shared/types.ts`.

## Deduplication strategy (Phase 3)

- Normalize URLs (strip tracking params, unify scheme/host casing).
- SHA-256 content hash over normalized title + url; unique constraint.
- Insert with conflict-ignore semantics; never reprocess existing articles.
