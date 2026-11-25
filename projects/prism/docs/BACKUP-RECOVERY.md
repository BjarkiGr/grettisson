# PRISM — Backup & Recovery (V2.1 Phase 4)

## Database export (free tier: manual pg_dump)
Supabase free tier has no automated daily backups. Procedure:
1. Dashboard -> Settings -> Database -> connection string (URI).
2. `pg_dump "<URI>" --no-owner --no-privileges -Fc -f prism-YYYYMMDD.dump`
   (requires PostgreSQL client tools installed locally).
3. Store the dump outside the repo (never commit it). Recommended
   cadence: weekly, and before every migration.
4. Migration history is preserved in Git (supabase/migrations/).

## Restoration
1. Create/restore a Supabase project; apply migrations 0001-0009 in order
   via SQL Editor (or `pg_restore --no-owner --no-privileges -d "<URI>"
   prism-YYYYMMDD.dump` for a full logical restore into an empty DB).
2. Re-create Edge Function secrets (AI_API_KEY etc.) and the Vault
   service key (docs/AUTOMATION.md).
3. Redeploy functions: `npx supabase functions deploy <names> --use-api`.
4. Verify: test/live-v2-schema-check.mjs + Settings system health.
NOTE: a full test restoration has NOT yet been performed (requires the
DB password; user action). Procedure documented, execution pending.

## Free-tier pause recovery
Project pauses after ~1 week without activity. Daily health cron reduces
likelihood. If paused: dashboard -> Restore project; cron schedules resume
automatically; no data loss. Verify last_ingestion_at afterwards.

## Key rotation
See docs/SECURITY.md (Groq + service key procedures).
