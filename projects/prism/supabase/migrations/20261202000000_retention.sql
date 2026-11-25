-- PRISM V2.1 Phase 4 — migration 0009: retention policy.
-- Completed jobs: 30 days. Failed jobs: 90 days. Cron history: 90 days.
-- Articles/events/risk history/company profiles: retained (articles pending
-- licensing review; events + risk history indefinite by design).
create or replace function public.prism_retention_cleanup()
returns jsonb
language plpgsql security definer set search_path = public, cron
as $$
declare c1 int; c2 int; c3 int;
begin
  delete from public.processing_jobs
    where status = 'completed' and completed_at < now() - interval '30 days';
  get diagnostics c1 = row_count;
  delete from public.processing_jobs
    where status = 'failed' and updated_at < now() - interval '90 days';
  get diagnostics c2 = row_count;
  delete from public.cron_runs
    where invoked_at < now() - interval '90 days';
  get diagnostics c3 = row_count;
  return jsonb_build_object('completed_jobs_deleted', c1, 'failed_jobs_deleted', c2, 'cron_runs_deleted', c3);
end $$;

revoke all on function public.prism_retention_cleanup() from public, anon, authenticated;
grant execute on function public.prism_retention_cleanup() to service_role;

-- Idempotent daily schedule (03:30 UTC).
select cron.unschedule('prism-retention') where exists (select 1 from cron.job where jobname = 'prism-retention');
select cron.schedule('prism-retention', '30 3 * * *', $job$select public.prism_retention_cleanup()$job$);
