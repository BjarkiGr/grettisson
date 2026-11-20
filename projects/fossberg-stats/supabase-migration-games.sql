-- ============================================================================
-- Fossberg Stats — MIGRATION: bætir Skuggabaldur og Krillion við
-- Keyrðu þetta EINU SINNI í SQL Editor ef þú keyrðir eldri supabase-setup.sql.
-- Öruggt að keyra aftur (idempotent). Núverandi skor fá game = sizeitup.
-- ============================================================================

-- 1. Nýr dálkur: leikur (gömlu skorin verða Size It Up)
alter table public.scores add column if not exists game text not null default 'sizeitup';

-- 2. Nýr einstakleikskilyrði: (name, game, puzzle) í stað (name, puzzle)
alter table public.scores drop constraint if exists scores_name_puzzle_key;
alter table public.scores drop constraint if exists scores_name_game_puzzle_key;
alter table public.scores add constraint scores_name_game_puzzle_key unique (name, game, puzzle);

-- 3. Víkka stigaskilyrðið (hámark per leik er í submit_score)
alter table public.scores drop constraint if exists scores_score_check;
alter table public.scores add constraint scores_score_check check (score >= 0);

alter table public.scores drop constraint if exists scores_game_check;
alter table public.scores add constraint scores_game_check check (game in ('sizeitup', 'skuggabaldur', 'krillion'));

-- 4. get_data skilar nú leik með hverju skori
create or replace function public.get_data()
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'users', coalesce((
      select jsonb_agg(jsonb_build_object('name', name) order by created_at)
      from players
    ), '[]'::jsonb),
    'scores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', name,
        'game', game,
        'puzzle', puzzle,
        'score', score,
        'rounds', rounds,
        'grid', grid,
        'timestamp', to_char(created_at, 'YYYY-MM-DD HH24:MI')
      ) order by puzzle desc, score desc)
      from scores
    ), '[]'::jsonb)
  );
$$;

-- 5. submit_score fær nýjan leik-parametra (gömlu útgáfunni er hent)
drop function if exists public.submit_score(text, text, integer, integer, text, jsonb);

create or replace function public.submit_score(
  p_name text, p_pin text, p_game text, p_puzzle integer, p_score integer,
  p_grid text, p_rounds jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user players%rowtype;
  v_pin  text := trim(coalesce(p_pin, ''));
  v_game text := lower(trim(coalesce(p_game, '')));
  v_max  integer;
begin
  select * into v_user from players
  where lower(name) = lower(trim(coalesce(p_name, '')));

  if not found or crypt(v_pin, v_user.pin_hash) is distinct from v_user.pin_hash then
    raise exception 'Innskráning rann út. Skráðu þig inn aftur.';
  end if;

  if v_game not in ('sizeitup', 'skuggabaldur', 'krillion') then
    raise exception 'Óþekktur leikur.';
  end if;

  -- Hámark per leik: Krillion hefur ekkert fast hámark.
  v_max := case v_game when 'sizeitup' then 500 when 'skuggabaldur' then 700 else null end;

  if p_puzzle is null or p_puzzle <= 0 or p_score is null or p_score < 0
     or (v_max is not null and p_score > v_max) then
    raise exception 'Ógilt þrautarnúmer eða stigafjöldi.';
  end if;

  insert into scores (name, game, puzzle, score, rounds, grid)
  values (v_user.name, v_game, p_puzzle, p_score, coalesce(p_rounds, '[]'::jsonb), coalesce(p_grid, ''))
  on conflict (name, game, puzzle) do update
    set score = excluded.score,
        rounds = excluded.rounds,
        grid = excluded.grid,
        created_at = now();

  return jsonb_build_object('status', 'ok');
end;
$$;

grant execute on function public.submit_score(text, text, text, integer, integer, text, jsonb) to anon, authenticated;
