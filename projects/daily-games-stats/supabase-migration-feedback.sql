-- ============================================================================
-- Daily Games Stats — MIGRATION: Ábendingar (feedback)
-- Keyrðu þetta EINU SINNI í SQL Editor. Öruggt að keyra aftur.
--
-- Öryggi:
--  * Öll föll eru SECURITY DEFINER með parameterized SQL — gildi eru ALDREI
--    límd inn í SQL-strengi (engin injection-hætta).
--  * RLS blokkar allan beinan aðgang að töflunni; aðeins föllin komast að henni.
--  * get_feedback / admin_delete_feedback staðfesta PIN + is_admin á þjóni.
--  * Lengdartakmörk (1–2000 stafir) og hófleg rate-limit (3 per nafn/klst,
--    30 samtals/klst) gegn misnotkun.
--  * Viðmótið HTML-escapar allan texta við birtingu (XSS-vörn).
-- ============================================================================

-- 1. Tafla fyrir ábendingar (nafn valfrjálst — nafnlausar ábendingar leyfðar)
create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  name       text not null default '',
  message    text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
-- Engar policies = enginn beinn aðgangur; aðeins föllin hér að neðan.

-- 2. Senda inn ábendingu (allir, líka nafnlausir)
create or replace function public.submit_feedback(p_name text, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_name text := left(trim(coalesce(p_name, '')), 25);
  v_msg  text := trim(coalesce(p_message, ''));
begin
  if v_msg = '' or char_length(v_msg) > 2000 then
    raise exception 'Ábending verður að vera 1–2000 stafir.';
  end if;

  -- Hófleg rate-limit: hámark 3 per nafn á klukkustund ...
  if v_name <> '' and (
    select count(*) from feedback
    where lower(name) = lower(v_name) and created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'Þú hefur þegar sent ábendingu nýlega. Reyndu aftur síðar.';
  end if;
  -- ... og hámark 30 samtals á klukkustund (gegndar einfaldri spammingu).
  if (select count(*) from feedback where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Of margar ábendingar á klukkustund. Reyndu aftur síðar.';
  end if;

  insert into feedback (name, message) values (v_name, v_msg);
  return jsonb_build_object('status', 'ok');
end;
$$;

-- 3. Lesa ábendingar (aðeins stjórnendur — PIN + is_admin staðfest á þjóni)
create or replace function public.get_feedback(p_name text, p_pin text)
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

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'message', message,
      'timestamp', to_char(created_at, 'YYYY-MM-DD HH24:MI')
    ) order by created_at desc)
    from (select * from feedback order by created_at desc limit 200) f
  ), '[]'::jsonb);
end;
$$;

-- 4. Eyða ábendingu (aðeins stjórnendur)
create or replace function public.admin_delete_feedback(p_name text, p_pin text, p_id bigint)
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

  delete from feedback where id = p_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

grant execute on function public.submit_feedback(text, text) to anon, authenticated;
grant execute on function public.get_feedback(text, text) to anon, authenticated;
grant execute on function public.admin_delete_feedback(text, text, bigint) to anon, authenticated;
