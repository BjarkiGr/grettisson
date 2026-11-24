-- ============================================================================
-- Daily Games Stats — MIGRATION: admin (Bjarki)
-- Keyrðu þetta EINU SINNI í SQL Editor. Öruggt að keyra aftur.
-- ============================================================================

-- 1. Admin-flaggi og Bjarki sem admin
alter table public.players add column if not exists is_admin boolean not null default false;
update public.players set is_admin = true where lower(name) = 'bjarki';

-- 2. login_player skilar nú isAdmin
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

-- 3. Admin-föll: hvert um sig staðfestir PIN + is_admin á þjóni.

-- Eyða einu skori
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

-- Eyða leikmanni (og öllum skorunum hans)
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

-- Endurstilla PIN leikmanns
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
