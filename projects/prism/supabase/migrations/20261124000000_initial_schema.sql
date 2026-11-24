-- ============================================================================
-- PRISM — 0001 initial schema (Phase 2)
-- Apply via Supabase SQL Editor (paste + Run) or: supabase db push
-- Idempotent: safe to run again. No credentials are stored in this file.
-- Access model (single-admin MVP):
--   * intelligence tables: SELECT for authenticated users only
--   * profiles/watchlists/event_watchlists: owner-only
--   * processing_jobs: backend (service role) only
--   * ALL writes to intelligence tables: service role only (no write policies)
--   * risk_scores is append-only (no update/delete policies anywhere)
-- ============================================================================

-- ---------- Enums -----------------------------------------------------------
do $$ begin
  create type public.event_category as enum (
    'military_conflict', 'political_instability', 'trade_restrictions',
    'sanctions', 'tariffs', 'natural_disasters', 'energy_disruptions',
    'shipping_disruptions', 'economic_instability', 'infrastructure_disruptions',
    'diplomatic_developments', 'cybersecurity_incidents'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.article_processing_status as enum (
    'pending', 'queued', 'processing', 'classified', 'analyzed', 'irrelevant', 'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.job_type as enum (
    'ingest', 'process_article', 'analyze_event', 'calculate_risk'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.job_status as enum (
    'pending', 'running', 'completed', 'failed', 'paused'
  );
exception when duplicate_object then null; end $$;

-- ---------- Helpers ---------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- profiles --------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'User information and preferences (single-admin MVP). Private via RLS.';

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile for every new auth user (runs as definer, bypasses RLS).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- sources ---------------------------------------------------------
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  feed_url text,
  source_type text not null default 'news_rss',
  country char(2),
  reliability_rating smallint check (reliability_rating between 1 and 5),
  active boolean not null default true,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.sources is 'Registered public information sources. Writes: service role only.';
create unique index if not exists sources_feed_url_key
  on public.sources (feed_url) where feed_url is not null;

-- ---------- articles --------------------------------------------------------
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete restrict,
  title text not null,
  url text not null,
  author text,
  published_at timestamptz,
  collected_at timestamptz not null default now(),
  content text,
  content_hash text not null unique,
  language text,
  processing_status public.article_processing_status not null default 'pending',
  created_at timestamptz not null default now()
);
comment on table public.articles is 'Collected articles. content may be an RSS excerpt, never assumed full text. Dedup via content_hash.';
create index if not exists articles_source_published_idx on public.articles (source_id, published_at desc);
create index if not exists articles_status_idx on public.articles (processing_status);
create index if not exists articles_published_idx on public.articles (published_at desc);

-- ---------- events ----------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  category public.event_category not null,
  primary_country char(2),
  region text,
  severity smallint check (severity between 0 and 5),
  status text not null default 'active' check (status in ('active', 'monitoring', 'resolved')),
  first_detected_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now()
);
comment on table public.events is 'Identified developments (not raw articles). Writes: service role only.';
create index if not exists events_region_idx on public.events (region);
create index if not exists events_category_idx on public.events (category);
create index if not exists events_country_idx on public.events (primary_country);

-- ---------- event_articles --------------------------------------------------
create table if not exists public.event_articles (
  event_id uuid not null references public.events(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, article_id)
);
comment on table public.event_articles is 'Many-to-many events <-> articles.';
create index if not exists event_articles_article_idx on public.event_articles (article_id);

-- ---------- analyses --------------------------------------------------------
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  article_id uuid references public.articles(id) on delete set null,
  provider text not null,
  model text not null,
  prompt_version text not null,
  analysis_json jsonb not null,
  confidence numeric(3,2) check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);
comment on table public.analyses is 'AI assessments with full provenance. Writes: service role only.';
create index if not exists analyses_event_idx on public.analyses (event_id, created_at desc);

-- ---------- risk_scores (append-only history) -------------------------------
create table if not exists public.risk_scores (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  severity_score smallint not null check (severity_score between 0 and 5),
  probability_score smallint not null check (probability_score between 0 and 5),
  geographic_score smallint not null check (geographic_score between 0 and 5),
  duration_score smallint not null check (duration_score between 0 and 5),
  supply_chain_score smallint not null check (supply_chain_score between 0 and 5),
  economic_score smallint not null check (economic_score between 0 and 5),
  overall_score smallint not null check (overall_score between 0 and 100),
  explanation text not null default '',
  confidence numeric(3,2) check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);
comment on table public.risk_scores is 'Historical dimension + overall scores. Append-only: no update/delete policies exist.';
create index if not exists risk_scores_event_idx on public.risk_scores (event_id, created_at desc);

-- ---------- watchlists ------------------------------------------------------
create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('country', 'region', 'commodity', 'industry', 'category')),
  target text not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, target)
);
comment on table public.watchlists is 'User monitoring preferences. Owner-only via RLS.';

-- ---------- event_watchlists ------------------------------------------------
create table if not exists public.event_watchlists (
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (watchlist_id, event_id)
);
create index if not exists event_watchlists_event_idx on public.event_watchlists (event_id);

-- ---------- processing_jobs -------------------------------------------------
create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type public.job_type not null,
  entity_id uuid,
  status public.job_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
comment on table public.processing_jobs is 'Database-backed queue. Backend (service role) only — no client policies.';
create index if not exists processing_jobs_status_idx on public.processing_jobs (status, job_type);
create unique index if not exists processing_jobs_active_entity_key
  on public.processing_jobs (job_type, entity_id)
  where entity_id is not null and status in ('pending', 'running');

drop trigger if exists processing_jobs_set_updated_at on public.processing_jobs;
create trigger processing_jobs_set_updated_at before update on public.processing_jobs
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.sources enable row level security;
alter table public.articles enable row level security;
alter table public.events enable row level security;
alter table public.event_articles enable row level security;
alter table public.analyses enable row level security;
alter table public.risk_scores enable row level security;
alter table public.watchlists enable row level security;
alter table public.event_watchlists enable row level security;
alter table public.processing_jobs enable row level security;

-- Intelligence: authenticated read only (single-admin MVP). No write policies
-- are created, so only the service role (Edge Functions) can write.
drop policy if exists sources_read_authenticated on public.sources;
create policy sources_read_authenticated on public.sources
  for select to authenticated using (true);

drop policy if exists articles_read_authenticated on public.articles;
create policy articles_read_authenticated on public.articles
  for select to authenticated using (true);

drop policy if exists events_read_authenticated on public.events;
create policy events_read_authenticated on public.events
  for select to authenticated using (true);

drop policy if exists event_articles_read_authenticated on public.event_articles;
create policy event_articles_read_authenticated on public.event_articles
  for select to authenticated using (true);

drop policy if exists analyses_read_authenticated on public.analyses;
create policy analyses_read_authenticated on public.analyses
  for select to authenticated using (true);

drop policy if exists risk_scores_read_authenticated on public.risk_scores;
create policy risk_scores_read_authenticated on public.risk_scores
  for select to authenticated using (true);

-- profiles: owner-only select/update (insert happens via the definer trigger).
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- watchlists: owner-only full CRUD.
drop policy if exists watchlists_select_own on public.watchlists;
create policy watchlists_select_own on public.watchlists
  for select to authenticated using (user_id = auth.uid());

drop policy if exists watchlists_insert_own on public.watchlists;
create policy watchlists_insert_own on public.watchlists
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists watchlists_update_own on public.watchlists;
create policy watchlists_update_own on public.watchlists
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists watchlists_delete_own on public.watchlists;
create policy watchlists_delete_own on public.watchlists
  for delete to authenticated using (user_id = auth.uid());

-- event_watchlists: access only through an owned watchlist.
drop policy if exists event_watchlists_select_own on public.event_watchlists;
create policy event_watchlists_select_own on public.event_watchlists
  for select to authenticated using (
    exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = auth.uid())
  );

drop policy if exists event_watchlists_insert_own on public.event_watchlists;
create policy event_watchlists_insert_own on public.event_watchlists
  for insert to authenticated with check (
    exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = auth.uid())
  );

drop policy if exists event_watchlists_delete_own on public.event_watchlists;
create policy event_watchlists_delete_own on public.event_watchlists
  for delete to authenticated using (
    exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = auth.uid())
  );

-- processing_jobs: RLS enabled with NO policies -> service role only.
-- risk_scores: no update/delete policies anywhere -> append-only history.

-- ============================================================================
-- PRIVILEGES (table-level GRANTs)
-- Newer Supabase projects do NOT auto-grant privileges on manually created
-- tables. RLS policies are the row gate; these GRANTs are the table gate.
-- Both layers are required. anon intentionally receives NO table privileges.
-- ============================================================================
grant usage on schema public to anon, authenticated, service_role;

-- Intelligence: authenticated read only.
grant select on public.sources, public.articles, public.events,
  public.event_articles, public.analyses, public.risk_scores
to authenticated;

-- Private user data: owner-scoped operations (RLS restricts to own rows).
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.watchlists, public.event_watchlists
to authenticated;

-- Backend (Edge Functions): full access; RLS is bypassed by service_role.
grant all on public.profiles, public.sources, public.articles, public.events,
  public.event_articles, public.analyses, public.risk_scores, public.watchlists,
  public.event_watchlists, public.processing_jobs
to service_role;

-- processing_jobs: no grants to anon/authenticated -> backend only.
-- risk_scores: no update/delete grants to clients -> append-only history.
