-- ============================================================================
-- PRISM — 0003 automation (Phase 7)
-- pg_cron + pg_net scheduling with Vault-secured credentials.
-- NO secrets in this file. After applying, run ONCE in the SQL Editor
-- (never committed):
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'prism_service_key',
--     'PRISM Edge Function invocation key');
-- Idempotent: safe to re-run.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------- execution history ----------------------------------------------
create table if not exists public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  request_id bigint,
  status text not null default 'invoked' check (status in ('invoked', 'completed', 'failed', 'skipped')),
  http_status integer,
  response_excerpt text,
  invoked_at timestamptz not null default now(),
  completed_at timestamptz
);
comment on table public.cron_runs is 'Scheduled invocation history. Writes via security-definer functions only.';
create index if not exists cron_runs_job_idx on public.cron_runs (job_name, invoked_at desc);

alter table public.cron_runs enable row level security;
drop policy if exists cron_runs_read_authenticated on public.cron_runs;
create policy cron_runs_read_authenticated on public.cron_runs
  for select to authenticated using (true);
grant select on public.cron_runs to authenticated;
grant all on public.cron_runs to service_role;

-- ---------- Vault-backed invoker (overlap-guarded) --------------------------
create or replace function public.invoke_edge_function(fn_name text)
returns bigint
language plpgsql security definer set search_path = public, net, vault
as $$
declare
  svc_key text;
  req_id bigint;
begin
  if fn_name not in ('ingest-sources', 'process-articles', 'analyze-events', 'calculate-risk', 'health-check') then
    raise exception 'unknown function: %', fn_name;
  end if;

  -- Overlap guard: skip if a previous invocation is still unacknowledged.
  if exists (
    select 1 from public.cron_runs
    where job_name = fn_name and status = 'invoked'
      and invoked_at > now() - interval '10 minutes'
  ) then
    insert into public.cron_runs (job_name, status) values (fn_name, 'skipped');
    return null;
  end if;

  select decrypted_secret into svc_key
  from vault.decrypted_secrets where name = 'prism_service_key' limit 1;
  if svc_key is null then
    insert into public.cron_runs (job_name, status, response_excerpt)
    values (fn_name, 'failed', 'vault secret prism_service_key missing');
    return null;
  end if;

  select net.http_post(
    url := 'https://yztwbnmaujcnpytewffz.supabase.co/functions/v1/' || fn_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key,
      'apikey', svc_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) into req_id;

  insert into public.cron_runs (job_name, request_id) values (fn_name, req_id);
  return req_id;
end $$;

revoke all on function public.invoke_edge_function(text) from public, anon;
grant execute on function public.invoke_edge_function(text) to authenticated, service_role;

-- ---------- response reaper -------------------------------------------------
create or replace function public.reap_cron_responses()
returns integer
language plpgsql security definer set search_path = public, net
as $$
declare
  n integer;
begin
  update public.cron_runs r
  set status = case when resp.status_code between 200 and 299 then 'completed' else 'failed' end,
      http_status = resp.status_code,
      response_excerpt = left(coalesce(resp.content, resp.error_msg, ''), 500),
      completed_at = now()
  from net._http_response resp
  where r.request_id = resp.id and r.status = 'invoked';
  get diagnostics n = row_count;

  update public.cron_runs
  set status = 'failed', response_excerpt = 'no response within 30 minutes', completed_at = now()
  where status = 'invoked' and invoked_at < now() - interval '30 minutes';

  delete from net._http_response where created < now() - interval '1 day';
  return n;
end $$;

revoke all on function public.reap_cron_responses() from public, anon, authenticated;
grant execute on function public.reap_cron_responses() to service_role;

-- ---------- automation status (no secrets exposed) --------------------------
create or replace function public.prism_automation_status()
returns jsonb
language plpgsql security definer set search_path = public, cron, vault
as $$
begin
  return jsonb_build_object(
    'vault_configured', exists (select 1 from vault.decrypted_secrets where name = 'prism_service_key'),
    'scheduled_jobs', (select count(*) from cron.job where jobname like 'prism-%'),
    'recent_runs', coalesce(
      (select jsonb_agg(t) from (
        select job_name, status, http_status, left(response_excerpt, 120) as excerpt, invoked_at
        from public.cron_runs order by invoked_at desc limit 10
      ) t), '[]'::jsonb)
  );
end $$;

revoke all on function public.prism_automation_status() from public, anon;
grant execute on function public.prism_automation_status() to authenticated, service_role;

-- ---------- schedules (initial settings; adjustable) ------------------------
-- Unschedule first so re-running this file never creates duplicates.
do $$ begin perform cron.unschedule('prism-ingest'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('prism-process'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('prism-analyze'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('prism-risk'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('prism-health'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('prism-reap'); exception when others then null; end $$;

select cron.schedule('prism-ingest', '*/30 * * * *', $cmd$select public.invoke_edge_function('ingest-sources')$cmd$);
select cron.schedule('prism-process', '*/15 * * * *', $cmd$select public.invoke_edge_function('process-articles')$cmd$);
select cron.schedule('prism-analyze', '*/15 * * * *', $cmd$select public.invoke_edge_function('analyze-events')$cmd$);
select cron.schedule('prism-risk', '0 * * * *', $cmd$select public.invoke_edge_function('calculate-risk')$cmd$);
select cron.schedule('prism-health', '0 6 * * *', $cmd$select public.invoke_edge_function('health-check')$cmd$);
select cron.schedule('prism-reap', '*/5 * * * *', $cmd$select public.reap_cron_responses()$cmd$);

-- NOTE: the service key is inserted into Vault separately (see header).
-- Until then, invocations record a 'failed' run with a clear reason and
-- nothing else breaks. Retries are safe: pipeline jobs are idempotent.
