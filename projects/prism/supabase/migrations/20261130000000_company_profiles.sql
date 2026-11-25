-- ============================================================================
-- PRISM V2 — 0007 company profiles (Phase 2)
-- Normalized, multi-user-compatible, OWNER-ONLY RLS on every table.
-- Every entry carries an origin: user_supplied | ai_confirmed |
-- imported_verified. AI suggestions are NEVER persisted without user
-- confirmation (the extract function only returns suggestions).
-- anon receives no privileges. Idempotent.
-- ============================================================================

create table if not exists public.company_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text,
  industry text,
  business_type text,
  description text,
  ai_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.company_profiles is 'PRIVATE company profile. Owner-only. Never exposed publicly or sent to AI except explicit consented extraction.';

drop trigger if exists company_profiles_set_updated_at on public.company_profiles;
create trigger company_profiles_set_updated_at before update on public.company_profiles
  for each row execute function public.set_updated_at();

create table if not exists public.company_industries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.company_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  industry text not null,
  origin text not null default 'user_supplied' check (origin in ('user_supplied', 'ai_confirmed', 'imported_verified')),
  created_at timestamptz not null default now(),
  unique (profile_id, industry)
);

create table if not exists public.company_commodities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.company_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  commodity_slug text not null,
  notes text,
  origin text not null default 'user_supplied' check (origin in ('user_supplied', 'ai_confirmed', 'imported_verified')),
  created_at timestamptz not null default now(),
  unique (profile_id, commodity_slug)
);

create table if not exists public.company_products (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.company_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  origin text not null default 'user_supplied' check (origin in ('user_supplied', 'ai_confirmed', 'imported_verified')),
  created_at timestamptz not null default now(),
  unique (profile_id, name)
);

create table if not exists public.company_countries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.company_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  country_code char(2) not null,
  role text not null default 'supplier' check (role in ('supplier', 'operating', 'customer', 'transport')),
  origin text not null default 'user_supplied' check (origin in ('user_supplied', 'ai_confirmed', 'imported_verified')),
  created_at timestamptz not null default now(),
  unique (profile_id, country_code, role)
);

create table if not exists public.company_dependencies (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.company_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('route', 'chokepoint', 'infrastructure', 'other')),
  ref text not null,
  confirmed boolean not null default false,
  origin text not null default 'user_supplied' check (origin in ('user_supplied', 'ai_confirmed', 'imported_verified')),
  created_at timestamptz not null default now(),
  unique (profile_id, kind, ref)
);

-- ---------- OWNER-ONLY RLS --------------------------------------------------
alter table public.company_profiles enable row level security;
alter table public.company_industries enable row level security;
alter table public.company_commodities enable row level security;
alter table public.company_products enable row level security;
alter table public.company_countries enable row level security;
alter table public.company_dependencies enable row level security;

drop policy if exists company_profiles_owner on public.company_profiles;
create policy company_profiles_owner on public.company_profiles
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['company_industries', 'company_commodities', 'company_products', 'company_countries', 'company_dependencies'] loop
    execute format('drop policy if exists %I_owner on public.%I', t, t);
    execute format('create policy %I_owner on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
  end loop;
end $$;

-- ---------- privileges ------------------------------------------------------
grant select, insert, update, delete on public.company_profiles, public.company_industries,
  public.company_commodities, public.company_products, public.company_countries,
  public.company_dependencies to authenticated;
grant all on public.company_profiles, public.company_industries, public.company_commodities,
  public.company_products, public.company_countries, public.company_dependencies to service_role;
-- anon: NO privileges on any company table.
