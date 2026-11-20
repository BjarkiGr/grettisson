-- ============================================================================
-- Size It Up — Stigatafla: Supabase uppsetning
-- Límdu allt þetta í SQL Editor í Supabase og ýttu á Run (sjá README.md).
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Spilarar: PIN geymt sem bcrypt-hash, aldrei lesanlegt úr viðmóti.
create table if not exists public.players (
  name       text primary key,
  pin_hash   text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists players_name_lower_idx on public.players (lower(name));

-- Skor: eitt per spilara per þraut (uppfærist við endursendingu).
create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  name       text not null references public.players (name) on update cascade on delete cascade,
  puzzle     integer not null check (puzzle > 0),
  score      integer not null check (score between 0 and 500),
  rounds     jsonb not null default '[]'::jsonb,
  grid       text not null default '',
  created_at timestamptz not null default now(),
  unique (name, puzzle)
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

  return jsonb_build_object('status', 'ok', 'name', v_user.name);
end;
$$;

-- Skrá eða uppfæra skor
create or replace function public.submit_score(
  p_name text, p_pin text, p_puzzle integer, p_score integer,
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
begin
  select * into v_user from players
  where lower(name) = lower(trim(coalesce(p_name, '')));

  if not found or crypt(v_pin, v_user.pin_hash) is distinct from v_user.pin_hash then
    raise exception 'Innskráning rann út. Skráðu þig inn aftur.';
  end if;

  if p_puzzle is null or p_puzzle <= 0 or p_score is null or p_score < 0 or p_score > 500 then
    raise exception 'Ógilt þrautarnúmer eða stigafjöldi.';
  end if;

  insert into scores (name, puzzle, score, rounds, grid)
  values (v_user.name, p_puzzle, p_score, coalesce(p_rounds, '[]'::jsonb), coalesce(p_grid, ''))
  on conflict (name, puzzle) do update
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
grant execute on function public.submit_score(text, text, integer, integer, text, jsonb) to anon, authenticated;
