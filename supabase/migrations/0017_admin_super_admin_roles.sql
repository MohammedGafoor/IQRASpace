-- Adds Admin / Super Admin to the existing role structure (users.role),
-- rather than a parallel permissions table — per the request, this reuses
-- the role column every other policy already keys off of.
--
-- Two new roles:
--   'admin'       — platform-wide READ access (oversight/reporting) across
--                   users, classes and lessons. Cannot change anyone's role.
--   'super_admin' — everything 'admin' gets, PLUS the only role allowed to
--                   change another user's role (public.set_user_role()).
--
-- Three things had to be fixed together, not as an afterthought:
--   1. public.handle_new_user() (0002) blindly trusted
--      auth.users.raw_user_meta_data ->> 'role' — with 'admin'/'super_admin'
--      now valid per the CHECK constraint, an unauthenticated caller of
--      supabase.auth.signUp() could otherwise self-register as super_admin
--      by passing that value directly (bypassing the signup UI, which only
--      offers Tutor/Student). Now hard-whitelisted to tutor/student/guardian.
--   2. "users_update_own" (0003) is `for update using (id = auth.uid())`
--      with no column restriction — a signed-in tutor/student could already
--      run `update users set role = 'admin' where id = auth.uid()` directly
--      against PostgREST. A trigger now blocks any row-level change to
--      `role` unless it goes through set_user_role() (super_admin only) or
--      the request is service_role (server-side scripts/seed tooling).
--   3. Admin/super_admin accounts can't be created via public signup at all
--      (see #1) — they're provisioned locally with
--      `npm run seed:admins` (apps/web/scripts/seed-admin-accounts.mjs),
--      which uses the service_role key to create the auth user directly and
--      is the intended, documented path (see ADMIN_EMAIL/SUPER_ADMIN_EMAIL
--      in .env.local.example).

-- ── 1. Extend the role vocabulary ───────────────────────────────────────
alter table public.users drop constraint users_role_check;
alter table public.users add constraint users_role_check
  check (role in ('tutor','student','guardian','admin','super_admin'));

-- ── 2. Lock down which roles public signup can grant ────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_full_name text;
begin
  v_role := coalesce(new.raw_user_meta_data ->> 'role', 'student');
  -- 'admin'/'super_admin' are never grantable through public signup
  -- metadata — those accounts are provisioned directly against this table
  -- by a service_role script (see header comment). Anything unrecognized,
  -- including a spoofed 'admin'/'super_admin', silently falls back to the
  -- safest default rather than erroring (keeps existing signup behavior
  -- for tutor/student/guardian unchanged).
  if v_role not in ('tutor','student','guardian') then
    v_role := 'student';
  end if;
  v_full_name := coalesce(new.raw_user_meta_data ->> 'full_name', new.email);

  insert into public.users (id, email, full_name, role)
  values (new.id, new.email, v_full_name, v_role);

  if v_role = 'tutor' then
    insert into public.tutors (id) values (new.id);
  elsif v_role = 'student' then
    insert into public.students (id) values (new.id);
  end if;

  return new;
end;
$$;

-- ── 3. Block direct role changes outside set_user_role() ────────────────
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     and coalesce(auth.role(), '') <> 'service_role'
     and coalesce(current_setting('app.allow_role_change', true), 'false') <> 'true'
  then
    raise exception 'role changes must go through public.set_user_role()';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_self_escalation on public.users;
create trigger trg_prevent_role_self_escalation
  before update on public.users
  for each row execute function public.prevent_role_self_escalation();

-- ── 4. Role-check helpers (STABLE SECURITY DEFINER, same pattern as 0004) ─
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role in ('admin','super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'super_admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;

-- ── 5. The only sanctioned way to change a role ──────────────────────────
create or replace function public.set_user_role(p_user_id uuid, p_new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized — only super_admin can change roles';
  end if;
  if p_new_role not in ('tutor','student','guardian','admin','super_admin') then
    raise exception 'Invalid role: %', p_new_role;
  end if;
  if p_user_id = auth.uid() and p_new_role <> 'super_admin' then
    raise exception 'Cannot change your own role away from super_admin';
  end if;

  perform set_config('app.allow_role_change', 'true', true);
  update public.users set role = p_new_role where id = p_user_id;

  if not found then
    raise exception 'No such user';
  end if;
end;
$$;

grant execute on function public.set_user_role(uuid, text) to authenticated;

-- ── 6. Platform-wide read access for oversight (admin dashboard) ────────
-- Read-only by design — admins/super_admins manage roles via
-- set_user_role() above, and everything else (classes, lessons, content)
-- stays owned and edited by its tutor, per every other policy in this
-- project. This is oversight/reporting visibility, not a backdoor write.
create policy "users_select_as_admin" on public.users
  for select using (public.is_admin());

create policy "classes_select_as_admin" on public.classes
  for select using (public.is_admin());

create policy "lessons_select_as_admin" on public.lessons
  for select using (public.is_admin());
