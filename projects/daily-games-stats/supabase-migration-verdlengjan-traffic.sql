-- ============================================================================
-- Daily Games Stats — MIGRATION: Verðlengjan heildarumferð (traffic)
-- Keyrðu þetta EINU SINNI í SQL Editor. Öruggt að keyra aftur.
--
-- Nafnlaus talning í Verðlengjan-leiknum sjálfum: ein 'visit' per vafra per
-- dag og ein 'complete' per daglega klárun. Engin persónugögn — aðeins
-- handahófskennt client-id (UUID) sem leikurinn geymir í localStorage.
-- ============================================================================

-- 1. Tafla fyrir atburði (einn per client per þraut per tegund)
create table if not exists public.verd_events (
  id bigint generated always as identity primary key,
  client_id uuid not null,
  puzzle integer not null,
  event text not null check (event in ('visit', 'complete')),
  created_at timestamptz not null default now(),
  unique (client_id, puzzle, event)
);

alter table public.verd_events enable row level security;
-- Engar policies = enginn beinn aðgangur; aðeins föllin hér að neðan.

-- 2. Skráning frá leiknum (anon-lykillinn er opinber, RLS verndar töfluna).
--    Þrautarnúmer má ekki vera framtíðarþraut (miðað við EPOCH 18.11.2026).
create or replace function public.verd_track(p_client uuid, p_puzzle integer, p_event text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_client is null or p_event is null or p_event not in ('visit', 'complete')
     or p_puzzle is null or p_puzzle < 1
     or p_puzzle > (current_date - date '2026-11-18' + 1) then
    raise exception 'Ógild atburðaskráning.';
  end if;

  insert into verd_events (client_id, puzzle, event)
  values (p_client, p_puzzle, p_event)
  on conflict (client_id, puzzle, event) do nothing;

  return jsonb_build_object('status', 'ok');
end;
$$;

-- 3. Lestur: ólíkir heimsækjendur og klárandi per dag (fyrir þátttökuspjaldið).
create or replace function public.verd_traffic()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'puzzle', puzzle, 'visits', visits, 'completes', completes
  ) order by puzzle desc), '[]'::jsonb)
  from (
    select puzzle,
      count(distinct client_id) filter (where event = 'visit') as visits,
      count(distinct client_id) filter (where event = 'complete') as completes
    from verd_events
    group by puzzle
  ) t;
$$;

grant execute on function public.verd_track(uuid, integer, text) to anon, authenticated;
grant execute on function public.verd_traffic() to anon, authenticated;
