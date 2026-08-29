-- RLS for the 5 tables added in 0013/0014 (lesson_plans, lesson_plan_items,
-- class_lesson_plans, student_lesson_progress, student_lesson_completions),
-- following the exact STABLE/SECURITY DEFINER helper convention from 0004/0010
-- — a raw cross-table EXISTS inside a policy is what caused 0004's recursion
-- bug, so every check here goes through a helper function instead.

create or replace function public.is_tutor_of_lesson_plan(p_lesson_plan_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.lesson_plans
    where id = p_lesson_plan_id and tutor_id = auth.uid()
  );
$$;

create or replace function public.is_tutor_of_lesson_plan_item(p_item_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.lesson_plan_items i
    join public.lesson_plans p on p.id = i.lesson_plan_id
    where i.id = p_item_id and p.tutor_id = auth.uid()
  );
$$;

-- A plan is visible to a student once it's assigned (via class_lesson_plans)
-- to any class that student is a member of.
create or replace function public.is_plan_visible_to_student(p_lesson_plan_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.class_lesson_plans clp
    where clp.lesson_plan_id = p_lesson_plan_id
      and public.is_member_of_class(clp.class_id)
  );
$$;

grant execute on function public.is_tutor_of_lesson_plan(uuid) to authenticated;
grant execute on function public.is_tutor_of_lesson_plan_item(uuid) to authenticated;
grant execute on function public.is_plan_visible_to_student(uuid) to authenticated;

-- ── lesson_plans ─────────────────────────────────────────────────────────
create policy "lesson_plans_tutor_all" on public.lesson_plans
  for all using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());

create policy "lesson_plans_student_select" on public.lesson_plans
  for select using (public.is_plan_visible_to_student(id));

-- ── lesson_plan_items ────────────────────────────────────────────────────
create policy "lesson_plan_items_tutor_all" on public.lesson_plan_items
  for all
  using (public.is_tutor_of_lesson_plan(lesson_plan_id))
  with check (public.is_tutor_of_lesson_plan(lesson_plan_id));

create policy "lesson_plan_items_student_select" on public.lesson_plan_items
  for select using (public.is_plan_visible_to_student(lesson_plan_id));

-- ── class_lesson_plans ───────────────────────────────────────────────────
create policy "class_lesson_plans_tutor_all" on public.class_lesson_plans
  for all
  using (public.is_tutor_of_class(class_id))
  with check (public.is_tutor_of_class(class_id));

create policy "class_lesson_plans_student_select" on public.class_lesson_plans
  for select using (public.is_member_of_class(class_id));

-- ── student_lesson_progress ──────────────────────────────────────────────
create policy "student_lesson_progress_tutor_all" on public.student_lesson_progress
  for all
  using (public.is_tutor_of_student(student_id))
  with check (public.is_tutor_of_student(student_id));

create policy "student_lesson_progress_student_select_own" on public.student_lesson_progress
  for select using (student_id = auth.uid());

-- ── student_lesson_completions ───────────────────────────────────────────
create policy "student_lesson_completions_tutor_all" on public.student_lesson_completions
  for all
  using (public.is_tutor_of_student(student_id))
  with check (public.is_tutor_of_student(student_id));

create policy "student_lesson_completions_student_select_own" on public.student_lesson_completions
  for select using (student_id = auth.uid());
