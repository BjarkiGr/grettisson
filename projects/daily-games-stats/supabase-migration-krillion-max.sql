-- ============================================================================
-- Daily Games Stats — MIGRATION: Krillion hámark = 700
-- Keyrðu þetta EINU SINNI í SQL Editor. Öruggt að keyra aftur.
-- ============================================================================

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

  if v_game not in ('sizeitup', 'skuggabaldur', 'krillion', 'verdlengjan') then
    raise exception 'Óþekktur leikur.';
  end if;

  -- Hámark per leik: Size It Up 500, Skuggabaldur 700, Krillion 700, Verðlengjan 102 + 5 fimmtudagsbonus.
  v_max := case v_game when 'sizeitup' then 500 when 'skuggabaldur' then 700 when 'krillion' then 700 when 'verdlengjan' then 107 else null end;

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
