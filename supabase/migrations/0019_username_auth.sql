-- Username-based authentication (Phase 3). Email becomes optional
-- everywhere — login, signup, admin-created accounts, and student
-- enrollment all move to `username` as the primary identifier.
--
-- Supabase Auth (GoTrue) itself still needs *some* email-shaped identifier
-- per account (there's no username-native grant type) — rather than a
-- custom auth system, this keeps GoTrue as-is and adds a thin resolution
-- layer on top:
--   - `auth_email`  — mirrors whatever email Supabase Auth actually has on
--                     file for this account (real, if one was given at
--                     signup; a synthetic `<username>@users.iqraspace.internal`
--                     otherwise, built client-side — see lib/username.ts).
--                     Technical/internal use only, never shown in the UI.
--   - `email`       — now a purely optional "contact" field, unrelated to
--                     how the account authenticates.
-- Login becomes two calls: public.get_auth_email_for_username(username) to
-- resolve `auth_email`, then the existing supabase.auth.signInWithPassword.

alter table public.users add column username text;
alter table public.users add column auth_email text;
alter table public.users add column phone text;

-- Backfill existing rows (all of them have a real email today) so the
-- NOT NULL constraints below don't fail on historical data. Most of these
-- rows are QA/test accounts removed right after this migration by
-- scripts/cleanup-users.mjs — the placeholder username just needs to be
-- unique, not meaningful.
update public.users
set username = lower(regexp_replace(split_part(coalesce(email, id::text), '@', 1), '[^a-z0-9_]', '', 'g')) || '_' || substr(id::text, 1, 8),
    auth_email = email
where username is null;

alter table public.users alter column username set not null;
alter table public.users alter column auth_email set not null;
alter table public.users add constraint users_username_key unique (username);
-- `email` keeps its existing UNIQUE constraint (from 0001) — Postgres
-- UNIQUE allows any number of NULLs, so multiple accounts with no contact
-- email is fine.
alter table public.users alter column email drop not null;

-- ── handle_new_user(): now requires `username` in signup metadata, and
-- separates the technical auth email (new.email, always present, real or
-- synthetic) from the optional contact email. ───────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_full_name text;
  v_username text;
begin
  v_role := coalesce(new.raw_user_meta_data ->> 'role', 'student');
  -- 'admin'/'super_admin' are never grantable through public signup
  -- metadata (see 0017) — anything unrecognized falls back to 'student'.
  if v_role not in ('tutor','student','guardian') then
    v_role := 'student';
  end if;

  v_username := new.raw_user_meta_data ->> 'username';
  if v_username is null or length(trim(v_username)) = 0 then
    raise exception 'username is required';
  end if;
  v_full_name := coalesce(new.raw_user_meta_data ->> 'full_name', v_username);

  insert into public.users (id, username, email, auth_email, full_name, role)
  values (new.id, v_username, new.raw_user_meta_data ->> 'contact_email', new.email, v_full_name, v_role);

  if v_role = 'tutor' then
    insert into public.tutors (id) values (new.id);
  elsif v_role = 'student' then
    insert into public.students (id) values (new.id);
  end if;

  return new;
end;
$$;

-- ── The only pre-auth (anon-callable) lookup: username -> auth email. ───
-- Reads just the one column needed to sign in — never the full profile.
-- SECURITY DEFINER bypasses RLS the same way is_admin()/is_tutor_of_class()
-- etc. already do elsewhere in this project (see 0004's header comment).
create or replace function public.get_auth_email_for_username(p_username text)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select auth_email from public.users where username = p_username limit 1;
$$;

grant execute on function public.get_auth_email_for_username(text) to anon, authenticated;

-- ── add_student_to_class(): email -> username, since a student may now
-- have no email at all. Parameter name changes, so this must be dropped
-- and recreated rather than CREATE OR REPLACE'd (Postgres rejects renaming
-- an input parameter in place). ──────────────────────────────────────────
drop function if exists public.add_student_to_class(uuid, text);

create function public.add_student_to_class(p_class_id uuid, p_student_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
begin
  if not exists (
    select 1 from public.classes where id = p_class_id and tutor_id = auth.uid()
  ) and not public.is_admin() then
    raise exception 'Not authorized for this class';
  end if;

  select id into v_student_id
  from public.users
  where username = p_student_username and role = 'student';

  if v_student_id is null then
    raise exception 'No student account found for that username';
  end if;

  insert into public.class_members (class_id, student_id)
  values (p_class_id, v_student_id)
  on conflict (class_id, student_id) do nothing;
end;
$$;

grant execute on function public.add_student_to_class(uuid, text) to authenticated;
