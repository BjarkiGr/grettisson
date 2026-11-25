# PRISM — Political Risk & Impact Scoring Model

Geopolitical risk and supply-chain intelligence platform. Collects public
information, identifies significant developments, evaluates consequences
with a free-tier AI provider, computes explainable risk scores and presents
structured intelligence in a static web dashboard — now with private
company profiles and personalized relevance.

**Status: V1 MVP + V2 (Phases 0-5) + V2.1 (Phases 0-6) complete.**
V2.1 = trust/intelligence/reliability release: security hardening, AI
integrity (prompt 2.1.0), risk validation, queue reliability, purchasing
intelligence. See docs/V2.1-RELEASE-NOTES.md.

- V1: live Supabase intelligence behind an admin-managed login gate
  (admin/viewer roles), full automated pipeline (pg_cron + Vault),
  Supply Chain Map, watchlists, Global/Iceland focus.
- V2: risk engine 2.0.0 (gates, likelihood bands, code-computed confidence,
  5x5 matrix, UNRATED path — docs/RISK-METHODOLOGY-V2.md); private company
  profiles (owner-only RLS, consented AI extraction, origin tagging);
  deterministic personalized relevance (exposure classes, separate from
  global risk); "My company" feed mode; why-this-matters event panels;
  profile-driven watchlist suggestions; new-relevance alerts.

## Layout

- `frontend/` — static site (HTML, CSS, vanilla ES modules; no build step),
  10 pages incl. Supply Chain Map and Company Profile.
- `supabase/` — config.toml, 7 migrations, 9 Edge Functions (Deno/TS).
- `docs/` — architecture, database, AI, risk methodology (V1+V2),
  automation, deployment, changelog.
- `test/` — zero-dependency Node smoke tests (23 suites, ~1300 checks).

## Quick start (development)

1. Serve the frontend over http (ES modules do not work from file://):
   `npx serve frontend` from this folder, or VS Code Live Server.
2. Run the tests: `node test/foundation-smoke.mjs` (and the other
   `*-smoke.mjs` suites; suites importing TypeScript need
   `node --experimental-strip-types`).
3. Supabase: see docs/DEPLOYMENT.md. Migrations are applied manually in
   the SQL Editor; functions deploy via
   `npx supabase functions deploy <name> --use-api`. Never commit secrets.

## Constraints

Vanilla JS frontend only; TypeScript only in Edge Functions; Supabase Free +
Render Static free + free-tier AI; zero recurring cost target; no Python,
Docker, VPS or paid services. Real intelligence data is never fabricated.
Company profiles are private: owner-only RLS, sent to the AI provider only
via explicit consented extraction, never auto-saved from AI suggestions.

## Roadmap

V1: 0 foundation -> 1 frontend -> 2 database/auth -> 3 ingestion -> 4 AI ->
5 risk scoring -> 6 dashboard integration -> 7 automation -> 8 deployment.
V2: 0 audit -> 1 risk methodology -> 2 company profile -> 3 relevance
engine -> 4 personalized feed -> 5 watchlists & alerts.
Each phase is approved before the next begins.
