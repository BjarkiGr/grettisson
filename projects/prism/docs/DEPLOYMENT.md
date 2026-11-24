# PRISM — Deployment (target state; executed in Phase 8)

Zero recurring cost target: Render Static Sites (free) + Supabase Free +
free-tier AI inference. No VPS, no home server, no Docker, no Python,
no permanently running backend.

## Frontend — Render Static Site

- Repository: github.com/BjarkiGr/grettisson (PRISM at projects/prism/).
- Root directory: `projects/prism/frontend`.
- Build command: none (pure static files, no build step).
- Publish directory: `.` (relative to the root directory above).
- Multi-page site with plain anchors — no SPA rewrite rules required.
  If client-side routing is added later, add a `/* -> /index.html` rewrite.
- Alternatively the whole grettisson repo can stay on its current host and
  PRISM be served at /projects/prism/frontend/ — decide in Phase 8.

## Supabase setup (Phase 2 onward)

1. Create a free Supabase project (one project per free account limit —
   note the existing daily-games-stats project may already use it; a second
   free project requires a second organization/account or reuse decision).
2. From `projects/prism/`: `supabase link --project-ref <ref>`.
3. Apply migrations: `supabase db push` (Phase 2).
4. Deploy functions: `supabase functions deploy <name>`.
5. Set secrets: `supabase secrets set AI_PROVIDER=... AI_API_KEY=...` (Phase 4).
6. Put the PUBLIC URL + anon key into `frontend/js/config.js` (Phase 2).

## Local development

- Frontend: any static file server, e.g. `npx serve projects/prism/frontend`
  or VS Code Live Server. ES modules require http(s), not file://.
- Edge Functions: `supabase functions serve --env-file supabase/functions/.env`
  (Supabase CLI bundles Deno; a standalone Deno install is optional).
- Tests: `node projects/prism/test/foundation-smoke.mjs` (no dependencies).

## Free-tier limits and known limitations

- **Supabase Free project pausing**: projects pause after ~1 week of
  inactivity. Recovery: open the Supabase dashboard and click Restore;
  scheduled jobs resume on the next tick. The daily health-check cron helps
  keep activity, but is not a guarantee — document and monitor.
- Edge Functions free: 500K invocations/month, limited wall-clock per
  invocation -> small batches, DB-backed queues, idempotent retries.
- Database free: 500 MB -> store article excerpts/metadata, prune old raw
  content, keep analyses/scores (small) long-term.
- Render static free: bandwidth limits; site is tiny.
- AI free tiers: request/token caps -> quota detection, pause + resume.
- If any free tier cannot support a requirement, the limitation is
  documented; paid services are never silently introduced.

## Backup and recovery (Phase 8)

- Migrations + source in Git = full rebuild capability.
- Periodic `supabase db dump` (manual, free) for data backups; procedure
  documented in Phase 8.

## Phase 2 runbook (manual dashboard steps)

1. **Apply the schema**: Supabase dashboard -> SQL Editor -> paste the full
   contents of `supabase/migrations/20261124000000_initial_schema.sql` -> Run.
   Re-running is safe (idempotent). IMPORTANT: the file now ends with a
   PRIVILEGES (GRANT) section — new Supabase projects do not auto-grant
   table privileges, so re-run the whole file once if you applied an
   earlier version without grants.
2. **Disable public sign-ups**: Authentication -> Sign In / Providers ->
   Email -> turn OFF "Allow new users to sign up". PRISM is single-admin.
3. **Create the administrator**: Authentication -> Users -> Add user ->
   enter your admin email + a strong password -> check "Auto Confirm User".
   The profile row is created automatically by trigger.
4. **Collect PUBLIC values**: Settings -> API -> Project URL and the
   anon/public key. Put them into `frontend/js/config.js`. These are public
   by design (RLS protects the data). NEVER put the service_role key there.
5. **Verify**: open settings.html -> "Run read tests". Signed out: zero
   visible rows everywhere. Signed in as admin: reads succeed (0 rows until
   Phase 3 ingests data). Also run `node test/phase2-smoke.mjs`.

## Phase 3 runbook (deployment of ingestion functions)

Run from `projects/prism/` (the folder containing `supabase/`). The Supabase
CLI is used via npx — no global install, no project dependency, no Docker.

1. `npx supabase login` — opens a browser; approve the CLI.
2. Apply migrations via the SQL Editor (recommended — no DB password or
   local Postgres needed): paste 20261124000000_initial_schema.sql, then
   20261125000000_seed_sources.sql. Both are idempotent.
   NOTE: avoid `supabase db push` unless `supabase link` succeeded — an
   unlinked CLI targets the LOCAL stack (127.0.0.1:54322) and fails with
   ECONNREFUSED. PRISM never uses the local Docker stack.
3. Deploy with an explicit project ref (no link required):
   `npx supabase functions deploy ingest-sources --project-ref yztwbnmaujcnpytewffz`
   `npx supabase functions deploy process-articles --project-ref yztwbnmaujcnpytewffz`
   `npx supabase functions deploy health-check --project-ref yztwbnmaujcnpytewffz`

The service-role key is injected automatically by the hosted runtime —
nothing secret is stored locally or in Git.

First ingestion run (after deploy): invoke ingest-sources, then
process-articles (repeat process-articles until processed=0; it handles 10
jobs per invocation). Verify real article counts via settings.html read
tests or the SQL Editor. Automation (cron) arrives in Phase 7.
