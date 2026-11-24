# PRISM — Automation (Phase 7)

Supabase Cron (pg_cron) invokes the Edge Functions via pg_net. Credentials
live in Supabase Vault; nothing secret is committed to Git.

## Schedules (initial; adjustable via cron.schedule)

| Job | Cron | Function |
|---|---|---|
| prism-ingest | */30 * * * * | ingest-sources |
| prism-process | */15 * * * * | process-articles |
| prism-analyze | */15 * * * * | analyze-events |
| prism-risk | 0 * * * * | calculate-risk |
| prism-health | 0 6 * * * | health-check |
| prism-reap | */5 * * * * | reap_cron_responses() |

## Security

- `invoke_edge_function(name)` is SECURITY DEFINER, whitelisted to the five
  PRISM functions, revoked from anon. It reads `prism_service_key` from
  Vault at call time; the key never appears in SQL files, logs or responses.
- `cron_runs` records every invocation (invoked/completed/failed/skipped,
  HTTP status, response excerpt). Authenticated read; writes only via the
  definer functions.

## Reliability

- Overlap guard: a new invocation is skipped if the previous one for the
  same function is still unacknowledged (<10 min).
- The reaper collects pg_net responses every 5 minutes, marks stale
  invocations failed after 30 minutes, and prunes response rows >1 day.
- Pipeline functions are idempotent with bounded retries, so missed or
  repeated ticks are safe. AI quota pauses auto-resume (10/60 min windows).
- Missing Vault secret => recorded 'failed' run with a clear reason; the
  rest of PRISM keeps working.

## Setup (one-time)

1. Apply `20261126000000_automation.sql` in the SQL Editor.
2. Insert the service key into Vault (SQL Editor, NEVER committed):
   `select vault.create_secret('<SERVICE_ROLE_KEY>', 'prism_service_key', 'PRISM Edge Function invocation key');`
   The key is in Dashboard -> Settings -> API (service_role / secret key).
3. Verify: health-check shows automation.vault_configured=true and
   scheduled_jobs=6; or run `select public.invoke_edge_function('health-check');`
   and inspect `select * from cron_runs order by invoked_at desc limit 5;`

## Free-tier notes

~150 invocations/day worst case — far below the 500K/month allowance.
pg_cron/pg_net are included on Supabase Free. If the project pauses from
inactivity, cron stops; restore via dashboard (daily health tick helps).
