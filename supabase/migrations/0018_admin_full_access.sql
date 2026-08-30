-- Phase 2 of platform administration. 0017 gave admin/super_admin read-only
-- oversight over users/classes/lessons only, plus super_admin-only role
-- changes. This migration makes good on "Admin = full access" for the
-- current startup phase: every table that had zero admin policy gets one,
-- the three oversight tables get write access to match, and the two
-- SECURITY DEFINER RPCs that carry their own *internal* authorization check
-- (independent of RLS) are widened to accept an admin caller too — otherwise
-- an admin would still hit "Not authorized" inside them even with every RLS
-- policy fixed.
--
-- Deliberately NOT a new permissions system: every new policy below is
-- exactly `using (is_admin())` / `with check (is_admin())`, reusing the same
-- STABLE SECURITY DEFINER helper 0017 already defined. super_admin is a
-- strict superset of admin (is_admin() returns true for both), so nothing
-- here differentiates them — that's intentional per this phase's scope.
-- is_super_admin() is left in place, unused for now, as the seam for a
-- future finer-grained split.
--
-- Naming convention: "<table>_all_as_admin", mirroring "<table>_tutor_all"
-- (0003/0010/0013/0016) and superseding the "_select_as_admin" policies
-- 0017 added on users/classes/lessons.

-- ── Tables with zero admin policy today ─────────────────────────────────
create policy "students_all_as_admin" on public.students
  for all using (public.is_admin()) with check (public.is_admin());

create policy "tutors_all_as_admin" on public.tutors
  for all using (public.is_admin()) with check (public.is_admin());

create policy "class_members_all_as_admin" on public.class_members
  for all using (public.is_admin()) with check (public.is_admin());

create policy "lesson_materials_all_as_admin" on public.lesson_materials
  for all using (public.is_admin()) with check (public.is_admin());

create policy "google_drive_files_all_as_admin" on public.google_drive_files
  for all using (public.is_admin()) with check (public.is_admin());

create policy "meetings_all_as_admin" on public.meetings
  for all using (public.is_admin()) with check (public.is_admin());

create policy "attendance_all_as_admin" on public.attendance
  for all using (public.is_admin()) with check (public.is_admin());

create policy "lesson_progress_all_as_admin" on public.lesson_progress
  for all using (public.is_admin()) with check (public.is_admin());

create policy "lesson_notes_all_as_admin" on public.lesson_notes
  for all using (public.is_admin()) with check (public.is_admin());

create policy "sharing_sessions_all_as_admin" on public.sharing_sessions
  for all using (public.is_admin()) with check (public.is_admin());

create policy "highlighted_content_all_as_admin" on public.highlighted_content
  for all using (public.is_admin()) with check (public.is_admin());

create policy "lesson_plans_all_as_admin" on public.lesson_plans
  for all using (public.is_admin()) with check (public.is_admin());

create policy "lesson_plan_items_all_as_admin" on public.lesson_plan_items
  for all using (public.is_admin()) with check (public.is_admin());

create policy "class_lesson_plans_all_as_admin" on public.class_lesson_plans
  for all using (public.is_admin()) with check (public.is_admin());

create policy "student_lesson_progress_all_as_admin" on public.student_lesson_progress
  for all using (public.is_admin()) with check (public.is_admin());

create policy "student_lesson_completions_all_as_admin" on public.student_lesson_completions
  for all using (public.is_admin()) with check (public.is_admin());

-- ── users / classes / lessons: upgrade 0017's SELECT-only admin policy to
-- FOR ALL. Role-column changes on `users` are still independently blocked
-- by trg_prevent_role_self_escalation regardless of which RLS policy let an
-- UPDATE through — this only widens *which* updates reach that trigger, it
-- doesn't bypass it. ────────────────────────────────────────────────────
drop policy if exists "users_select_as_admin" on public.users;
create policy "users_all_as_admin" on public.users
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "classes_select_as_admin" on public.classes;
create policy "classes_all_as_admin" on public.classes
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "lessons_select_as_admin" on public.lessons;
create policy "lessons_all_as_admin" on public.lessons
  for all using (public.is_admin()) with check (public.is_admin());

-- ── lesson-materials Storage bucket: admin bypass for write ops. Read/list
-- is already open to any authenticated user (0011's
-- "lesson_materials_bucket_authenticated_read"), so admin can already list
-- and preview every tutor's folder — only insert/update/delete are
-- currently restricted to "your own folder" (auth.uid() == top-level path
-- segment), which an admin acting on another tutor's material would fail. ─
create policy "lesson_materials_bucket_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'lesson-materials' and public.is_admin());

create policy "lesson_materials_bucket_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'lesson-materials' and public.is_admin());

create policy "lesson_materials_bucket_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'lesson-materials' and public.is_admin());

-- ── add_student_to_class(): its ownership check is independent of RLS
-- (SECURITY DEFINER, reads with elevated privilege), so it needs its own
-- admin bypass — the table-level RLS policy above doesn't reach inside it. ─
create or replace function public.add_student_to_class(p_class_id uuid, p_student_email text)
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
  where email = p_student_email and role = 'student';

  if v_student_id is null then
    raise exception 'No student account found for that email';
  end if;

  insert into public.class_members (class_id, student_id)
  values (p_class_id, v_student_id)
  on conflict (class_id, student_id) do nothing;
end;
$$;

-- ── notify_user(): same shape — let an admin notify a student they don't
-- personally tutor (e.g. marking attendance/notes on another tutor's
-- classes). ────────────────────────────────────────────────────────────
create or replace function public.notify_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_related_lesson_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_user_id <> auth.uid() and not public.is_tutor_of_student(p_user_id) and not public.is_admin() then
    raise exception 'Not authorized to notify this user';
  end if;

  insert into public.notifications (user_id, type, title, body, related_lesson_id)
  values (p_user_id, p_type, p_title, p_body, p_related_lesson_id)
  returning id into v_id;

  return v_id;
end;
$$;

-- ── set_user_role(): relax from is_super_admin() to is_admin() — every
-- other write path added in this migration is is_admin()-gated, so keeping
-- role changes as a super_admin-only carve-out would contradict the "Admin
-- = full access" intent of this phase without meaningfully reducing risk
-- (an admin who can already edit/delete any row gains little additional
-- blast radius from also calling this RPC). The self-lockout guard widens
-- from "can't remove your own super_admin" to "can't remove your own
-- admin-level access" so a plain admin can't strip their own access either.
-- is_super_admin() itself is untouched, ready for a future finer split. ──
create or replace function public.set_user_role(p_user_id uuid, p_new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized — only admin/super_admin can change roles';
  end if;
  if p_new_role not in ('tutor','student','guardian','admin','super_admin') then
    raise exception 'Invalid role: %', p_new_role;
  end if;
  if p_user_id = auth.uid() and p_new_role not in ('admin','super_admin') then
    raise exception 'Cannot remove your own admin access';
  end if;

  perform set_config('app.allow_role_change', 'true', true);
  update public.users set role = p_new_role where id = p_user_id;

  if not found then
    raise exception 'No such user';
  end if;
end;
$$;
