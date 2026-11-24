-- ============================================================================
-- PRISM — 0005 user roles (admin-managed users)
-- Adds profiles.role (admin/viewer). The FIRST created auth user becomes
-- admin. Viewers can read intelligence and manage their own watchlists,
-- but cannot manage users.
-- SECURITY: profiles updates are restricted to non-role columns via
-- column-level grants, so a viewer cannot self-promote through the
-- owner-update RLS policy. Idempotent.
-- ============================================================================

alter table public.profiles
  add column if not exists role text not null default 'viewer'
  check (role in ('admin', 'viewer'));

comment on column public.profiles.role is 'admin = user management; viewer = read intelligence + own watchlists. Set only via service role.';

-- The original administrator (first auth user ever created) keeps admin.
update public.profiles
set role = 'admin'
where id = (select id from auth.users order by created_at asc limit 1)
  and role <> 'admin';

-- Column-level privilege hardening: owners may update ONLY these columns.
revoke update on public.profiles from authenticated;
grant update (display_name, preferences) on public.profiles to authenticated;
-- service_role keeps full access (role changes happen only server-side).
