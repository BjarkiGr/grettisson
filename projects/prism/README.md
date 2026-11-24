# PRISM — Political Risk & Impact Scoring Model

Geopolitical risk and supply-chain intelligence platform. Collects public
information, identifies significant developments, evaluates consequences
with a free-tier AI provider, computes explainable risk scores and presents
structured intelligence in a static web dashboard.

**Status: MVP complete (Phases 0-8).** PRISM renders live Supabase
intelligence (articles, AI analyses, explainable risk scores) behind an
administrator login gate. Watchlists are functional. Phase 7 automation
(cron + Vault) is ready to apply — see docs/AUTOMATION.md.

## Layout

- `frontend/` — static site (HTML, CSS, vanilla ES modules; no build step),
  including a Supply Chain Map with animated corridors and destination-based
  disruption overlays from live intelligence.
- `supabase/` — config.toml, migrations (Phase 2), Edge Functions (Deno/TS).
- `docs/` — architecture, database, AI, risk methodology, deployment, changelog.
- `test/` — zero-dependency Node smoke tests.

## Quick start (development)

1. Serve the frontend over http (ES modules do not work from file://):
   `npx serve frontend` from this folder, or VS Code Live Server.
2. Run the tests: `node test/foundation-smoke.mjs` and
   `node test/phase1-smoke.mjs` and `node test/phase2-smoke.mjs`.
3. Supabase work (Phase 2+): see docs/DEPLOYMENT.md. Copy `.env.example`
   files for local secrets; never commit real credentials.

## Constraints

Vanilla JS frontend only; TypeScript only in Edge Functions; Supabase Free +
Render Static free + free-tier AI; zero recurring cost target; no Python,
Docker, VPS or paid services. Demonstration data (Phase 1) will always be
clearly marked; real intelligence data is never fabricated.

## Roadmap

Phase 0 foundation -> 1 frontend -> 2 database/auth -> 3 ingestion ->
4 AI -> 5 risk scoring -> 6 dashboard integration -> 7 automation ->
8 deployment. Each phase is approved before the next begins.