-- ============================================================================
-- Daily Games Stats — Supabase uppsetning (Size It Up, Skuggabaldur, Krillion, Verðlengjan)
-- Límdu allt þetta í SQL Editor í Supabase og ýttu á Run (sjá README.md).
-- ATH: Ef þú keyrðir eldri útgáfu af þessari skriptu skaltu keyra
-- supabase-migration-games.sql í staðinn (hún uppfærir núverandi gögn).
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Spilarar: PIN geymt sem bcrypt-hash, aldrei lesanlegt úr viðmóti.
create table if not exists public.players (
  name       text primary key,
  pin_hash   text not null,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists players_name_lower_idx on public.players (lower(name));

-- Skor: eitt per spilara per leik per þraut (uppfærist við endursendingu).
create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  name       text not null references public.players (name) on update cascade on delete cascade,
  game       text not null default 'sizeitup' check (game in ('sizeitup', 'skuggabaldur', 'krillion', 'verdlengjan')),
  puzzle     integer not null check (puzzle > 0),
  score      integer not null check (score >= 0),
  rounds     jsonb not null default '[]'::jsonb,
  grid       text not null default '',
  created_at timestamptz not null default now(),
  unique (name, game, puzzle)
);

-- Row Level Security: enginn beinn aðgangur með anon-lyklinum.
-- Allur aðgangur fer í gegnum SECURITY DEFINER föllin hér að neðan,
-- sem staðfesta PIN sjálf (sama og password_verify í PHP-útgáfunni).
alter table public.players enable row level security;
alter table public.scores  enable row level security;

-- Sækja stöðu og notendur (án PIN-hasha)
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

-- Nýskráning með 4 stafa PIN
create or replace function public.register_player(p_name text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_pin  text := trim(coalesce(p_pin, ''));
begin
  if v_name = '' or char_length(v_name) > 25 or v_pin !~ '^\d{4}$' then
    raise exception 'Sláðu inn nafn (hámark 25 stafir) og 4 tölustafa PIN.';
  end if;

  if exists (select 1 from players where lower(name) = lower(v_name)) then
    raise exception 'Þetta nafn er þegar frátekið.';
  end if;

  insert into players (name, pin_hash)
  values (v_name, crypt(v_pin, gen_salt('bf')));

  return jsonb_build_object('status', 'ok', 'name', v_name);
end;
$$;

-- Innskráning
create or replace function public.login_player(p_name text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user players%rowtype;
  v_pin  text := trim(coalesce(p_pin, ''));
begin
  select * into v_user from players
  where lower(name) = lower(trim(coalesce(p_name, '')));

  if not found or crypt(v_pin, v_user.pin_hash) is distinct from v_user.pin_hash then
    raise exception 'Rangt nafn eða PIN-númer.';
  end if;

  return jsonb_build_object('status', 'ok', 'name', v_user.name, 'isAdmin', v_user.is_admin);
end;
$$;

-- Skrá eða uppfæra skor (per leik)
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

-- Leyfa anon-lyklinum að kalla á föllin (og ekkert annað).
grant execute on function public.get_data() to anon, authenticated;
grant execute on function public.register_player(text, text) to anon, authenticated;
grant execute on function public.login_player(text, text) to anon, authenticated;
grant execute on function public.submit_score(text, text, text, integer, integer, text, jsonb) to anon, authenticated;

-- ============================================================================
-- ADMIN: is_admin flagið er á players. Eftir nýskráningu þíns fyrsta
-- stjórnanda, keyrðu (skiptu út nafninu):
--   update public.players set is_admin = true where lower(name) = 'bjarki';
-- ============================================================================

-- Eyða einu skori (admin)
create or replace function public.admin_delete_score(
  p_name text, p_pin text, p_target text, p_game text, p_puzzle integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user players%rowtype;
  v_pin  text := trim(coalesce(p_pin, ''));
begin
  select * into v_user from players
  where lower(name) = lower(trim(coalesce(p_name, '')));

  if not found or crypt(v_pin, v_user.pin_hash) is distinct from v_user.pin_hash
     or not v_user.is_admin then
    raise exception 'Aðeins stjórnendur geta gert þetta.';
  end if;

  delete from scores
  where lower(name) = lower(trim(coalesce(p_target, '')))
    and game = p_game and puzzle = p_puzzle;

  return jsonb_build_object('status', 'ok');
end;
$$;

-- Eyða leikmanni og öllum skorunum hans (admin)
create or replace function public.admin_delete_player(p_name text, p_pin text, p_target text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user players%rowtype;
  v_pin  text := trim(coalesce(p_pin, ''));
  v_target text := trim(coalesce(p_target, ''));
begin
  select * into v_user from players
  where lower(name) = lower(trim(coalesce(p_name, '')));

  if not found or crypt(v_pin, v_user.pin_hash) is distinct from v_user.pin_hash
     or not v_user.is_admin then
    raise exception 'Aðeins stjórnendur geta gert þetta.';
  end if;

  if lower(v_target) = lower(v_user.name) then
    raise exception 'Þú getur ekki eytt þínum eigin aðgangi.';
  end if;

  delete from players where lower(name) = lower(v_target);

  return jsonb_build_object('status', 'ok');
end;
$$;

-- Endurstilla PIN leikmanns (admin)
create or replace function public.admin_reset_pin(
  p_name text, p_pin text, p_target text, p_new_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user players%rowtype;
  v_pin  text := trim(coalesce(p_pin, ''));
  v_new  text := trim(coalesce(p_new_pin, ''));
begin
  select * into v_user from players
  where lower(name) = lower(trim(coalesce(p_name, '')));

  if not found or crypt(v_pin, v_user.pin_hash) is distinct from v_user.pin_hash
     or not v_user.is_admin then
    raise exception 'Aðeins stjórnendur geta gert þetta.';
  end if;

  if v_new !~ '^\d{4}$' then
    raise exception 'PIN verður að vera nákvæmlega 4 tölustafir.';
  end if;

  update players set pin_hash = crypt(v_new, gen_salt('bf'))
  where lower(name) = lower(trim(coalesce(p_target, '')));

  if not found then
    raise exception 'Leikmaður fannst ekki.';
  end if;

  return jsonb_build_object('status', 'ok');
end;
$$;

grant execute on function public.admin_delete_score(text, text, text, text, integer) to anon, authenticated;
grant execute on function public.admin_delete_player(text, text, text) to anon, authenticated;
grant execute on function public.admin_reset_pin(text, text, text, text) to anon, authenticated;
