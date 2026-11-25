# PRISM — Operations & Monitoring (V2.1 Phase 4)

## System states (Settings -> System health, system-status function)
- HEALTHY: ingestion within 2h (cron cadence 30 min), <=5 failed jobs.
- DELAYED: last ingestion 2-24h ago.
- DEGRADED: last ingestion 24-72h ago OR >5 failed jobs.
- FAILED: no ingestion ever or >72h ago (project paused? cron broken?).
- PAUSED: AI jobs paused (Groq rate/quota window; auto-resume 10/60 min).

## Queue reliability
- Atomic claim: update ... where status=pending (race-safe).
- Stale recovery: every pipeline run resets running>30min jobs to pending
  (attempts<3) or failed/dead-letter (attempts>=3). No indefinite running.
- Retries bounded at 3 attempts; failures recorded with last_error.

## Retention (migration 0009, daily 03:30 UTC)
- completed jobs: 30 days; failed jobs: 90 days; cron_runs: 90 days.
- Articles/events/risk history/company profiles: retained. Article excerpt
  deletion (12 months proposed) DEFERRED pending licensing review.

## Troubleshooting
- FAILED state: check Supabase project paused (free tier ~1 week idle);
  restore in dashboard; cron resumes automatically.
- PAUSED: Groq quota; wait for auto-resume; check AI_API_KEY validity.
- Stuck jobs: inspect processing_jobs (SQL editor); stale recovery runs
  on every pipeline tick; manual: update status to pending where stuck.
- See docs/BACKUP-RECOVERY.md for export/restore.
