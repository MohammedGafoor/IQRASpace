-- RLS policies for the 8 tables that have had RLS enabled (deny-by-default,
-- since 0001) but zero policies: google_drive_files, lesson_materials,
-- meetings, attendance, lesson_progress, lesson_notes, sharing_sessions,
-- highlighted_content. Pulled forward from the Phase 6 security pass for the
-- same reason 0003 was — these tables are otherwise completely unreachable
-- from the client, and the expanded Phase 1 scope (docs/PROGRESS.md) now
-- builds real features on top of all of them.
--
-- Two new helper functions, same STABLE/SECURITY DEFINER pattern as
-- is_tutor_of_class/is_member_of_class (0004), to avoid re-deriving the
-- lesson -> class -> membership join in six separate policies.

create or replace function public.is_tutor_of_lesson(p_lesson_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.lessons
    where id = p_lesson_id and tutor_id = auth.uid()
  );
$$;

create or replace function public.is_member_of_lesson(p_lesson_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.lessons l
    join public.class_members cm on cm.class_id = l.class_id
    where l.id = p_lesson_id and cm.student_id = auth.uid()
  );
$$;

grant execute on function public.is_tutor_of_lesson(uuid) to authenticated;
grant execute on function public.is_member_of_lesson(uuid) to authenticated;

-- ── google_drive_files ───────────────────────────────────────────────────
-- Owned directly by a tutor, no lesson linkage yet at link-time.
create policy "drive_files_tutor_all" on public.google_drive_files
  for all using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());

-- ── lesson_materials ─────────────────────────────────────────────────────
create policy "lesson_materials_tutor_all" on public.lesson_materials
  for all
  using (public.is_tutor_of_lesson(lesson_id))
  with check (public.is_tutor_of_lesson(lesson_id));

create policy "lesson_materials_student_select" on public.lesson_materials
  for select using (public.is_member_of_lesson(lesson_id));

-- ── meetings ─────────────────────────────────────────────────────────────
create policy "meetings_tutor_all" on public.meetings
  for all
  using (public.is_tutor_of_lesson(lesson_id))
  with check (public.is_tutor_of_lesson(lesson_id));

create policy "meetings_student_select" on public.meetings
  for select using (public.is_member_of_lesson(lesson_id));

-- ── attendance ───────────────────────────────────────────────────────────
create policy "attendance_tutor_all" on public.attendance
  for all
  using (public.is_tutor_of_lesson(lesson_id))
  with check (public.is_tutor_of_lesson(lesson_id));

create policy "attendance_student_select_own" on public.attendance
  for select using (student_id = auth.uid());

-- ── lesson_progress ──────────────────────────────────────────────────────
create policy "lesson_progress_tutor_all" on public.lesson_progress
  for all
  using (public.is_tutor_of_lesson(lesson_id))
  with check (public.is_tutor_of_lesson(lesson_id));

create policy "lesson_progress_student_select_own" on public.lesson_progress
  for select using (student_id = auth.uid());

-- ── lesson_notes ─────────────────────────────────────────────────────────
-- Notes are about the lesson as a whole (not per-student), so any student in
-- the class can read them, matching "view own lesson history" (architecture §4).
create policy "lesson_notes_tutor_all" on public.lesson_notes
  for all
  using (public.is_tutor_of_lesson(lesson_id))
  with check (public.is_tutor_of_lesson(lesson_id));

create policy "lesson_notes_student_select" on public.lesson_notes
  for select using (public.is_member_of_lesson(lesson_id));

-- ── sharing_sessions ─────────────────────────────────────────────────────
create policy "sharing_sessions_tutor_all" on public.sharing_sessions
  for all
  using (public.is_tutor_of_lesson(lesson_id))
  with check (public.is_tutor_of_lesson(lesson_id));

create policy "sharing_sessions_student_select" on public.sharing_sessions
  for select using (public.is_member_of_lesson(lesson_id));

-- ── highlighted_content ──────────────────────────────────────────────────
-- One join deeper (via sharing_sessions -> lessons); plain EXISTS is safe
-- here since neither sharing_sessions nor highlighted_content policies are
-- referenced back by classes/lessons/class_members, so there's no cycle.
create policy "highlighted_content_tutor_all" on public.highlighted_content
  for all
  using (
    exists (
      select 1 from public.sharing_sessions ss
      where ss.id = highlighted_content.sharing_session_id
        and public.is_tutor_of_lesson(ss.lesson_id)
    )
  )
  with check (
    exists (
      select 1 from public.sharing_sessions ss
      where ss.id = highlighted_content.sharing_session_id
        and public.is_tutor_of_lesson(ss.lesson_id)
    )
  );

create policy "highlighted_content_student_select" on public.highlighted_content
  for select using (
    exists (
      select 1 from public.sharing_sessions ss
      where ss.id = highlighted_content.sharing_session_id
        and public.is_member_of_lesson(ss.lesson_id)
    )
  );
