-- Lesson Plans (curriculum) were wrongly modeled as tutor-owned
-- (lesson_plans.tutor_id NOT NULL REFERENCES tutors(id)) — the user's
-- intended architecture has a Lesson Plan as a UNIVERSAL, reusable
-- curriculum that any number of tutors can browse and assign to their own
-- classes, with each student's position in it kept personalized
-- (student_lesson_progress/student_lesson_completions — already keyed by
-- student_id, not tutor_id, so those needed no change). This migration
-- removes the ownership column and its RLS, and replaces it with:
--   - admin/super_admin: full CRUD (unchanged — lesson_plans_all_as_admin /
--     lesson_plan_items_all_as_admin from 0018 reference is_admin() only,
--     not tutor_id, so they already keep working as-is).
--   - any tutor: read-only across the whole catalog (new — decided with the
--     user that curriculum editing is admin-only for this phase; a tutor
--     still assigns their own class to any plan via class_lesson_plans,
--     which was already gated purely on class ownership, not plan
--     ownership, so it needed no change either).
--   - student: unchanged narrower "only my assigned plan" visibility via
--     is_plan_visible_to_student().

-- ── Drop what references tutor_id before dropping the column itself. ────
drop policy if exists "lesson_plans_tutor_all" on public.lesson_plans;
drop policy if exists "lesson_plan_items_tutor_all" on public.lesson_plan_items;
drop function if exists public.is_tutor_of_lesson_plan(uuid);
-- Was defined in 0016 but never actually referenced by any policy — dead
-- code, safe to drop alongside its sibling.
drop function if exists public.is_tutor_of_lesson_plan_item(uuid);

alter table public.lesson_plans drop column tutor_id; -- auto-drops idx_lesson_plans_tutor

-- ── Read access for the "any tutor may browse the shared catalog" case. ──
create or replace function public.is_any_tutor()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'tutor'
  );
$$;

grant execute on function public.is_any_tutor() to authenticated;

create policy "lesson_plans_select_for_tutors" on public.lesson_plans
  for select using (public.is_any_tutor());

create policy "lesson_plan_items_select_for_tutors" on public.lesson_plan_items
  for select using (public.is_any_tutor());
