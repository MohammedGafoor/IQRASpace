-- Closes a real gap in the Universal Lesson Plan flow: a class assigned to a
-- plan only seeded `student_lesson_progress` for students who were already
-- enrolled *at that moment* (the client-side loop in lessons/page.tsx's
-- assignClass()). A student added to the class afterward — via
-- add_student_to_class() (0019) or the admin panel — got no curriculum row
-- at all, so nothing ever showed them a current lesson.
--
-- Fix: move the seeding into two AFTER INSERT triggers so it happens
-- consistently no matter which path adds the row, and drop the now-redundant
-- client-side loop (see apps/web/src/app/(app)/lessons/page.tsx).
--
-- SECURITY DEFINER, following the convention already used by
-- add_student_to_class()/notify_user()/set_user_role() (0003/0009/0017) —
-- this always succeeds once the triggering insert itself was authorized by
-- RLS, regardless of the small RLS-visibility edge cases a same-transaction
-- write could otherwise hit.

create or replace function public.seed_student_lesson_progress(
  p_class_id uuid,
  p_lesson_plan_id uuid,
  p_student_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first_item_id uuid;
begin
  select id into v_first_item_id
  from public.lesson_plan_items
  where lesson_plan_id = p_lesson_plan_id and active = true
  order by sequence
  limit 1;

  if v_first_item_id is null then
    return; -- plan has no active items yet — nothing to seed
  end if;

  insert into public.student_lesson_progress (student_id, lesson_plan_id, current_item_id, status)
  select cm.student_id, p_lesson_plan_id, v_first_item_id, 'not_started'
  from public.class_members cm
  where cm.class_id = p_class_id
    and (p_student_id is null or cm.student_id = p_student_id)
  on conflict (student_id, lesson_plan_id) do nothing;
end;
$$;

grant execute on function public.seed_student_lesson_progress(uuid, uuid, uuid) to authenticated;

-- ── Trigger: a class gets assigned to a plan → seed every current member ──
create or replace function public.trg_seed_progress_on_plan_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_student_lesson_progress(new.class_id, new.lesson_plan_id);
  return new;
end;
$$;

drop trigger if exists seed_progress_on_plan_assigned on public.class_lesson_plans;
create trigger seed_progress_on_plan_assigned
  after insert on public.class_lesson_plans
  for each row execute function public.trg_seed_progress_on_plan_assigned();

-- ── Trigger: a student joins a class that already has a plan → seed them ──
create or replace function public.trg_seed_progress_on_member_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
begin
  select lesson_plan_id into v_plan_id
  from public.class_lesson_plans
  where class_id = new.class_id;

  if v_plan_id is not null then
    perform public.seed_student_lesson_progress(new.class_id, v_plan_id, new.student_id);
  end if;
  return new;
end;
$$;

drop trigger if exists seed_progress_on_member_added on public.class_members;
create trigger seed_progress_on_member_added
  after insert on public.class_members
  for each row execute function public.trg_seed_progress_on_member_added();

-- ── Second gap: student_lesson_completions.confirmed_by → tutors(id) ──────
-- Admin/super_admin accounts are deliberately given NO row in `tutors`
-- (scripts/seed-admin-accounts.mjs explicitly deletes any stray one), yet
-- ConfirmLessonCompletionModal's "confirm complete" action — and the new
-- per-student progress manager — are both usable by an admin
-- (canManage = isTutor || isAdminRole across the app). An admin confirming a
-- completion would violate this FK today. `confirmed_by` only needs to
-- record *who* confirmed it, not a tutor-settings row, so point it at
-- `users` instead — every tutor row is still a users row, so no existing
-- data is invalidated.
alter table public.student_lesson_completions
  drop constraint if exists student_lesson_completions_confirmed_by_fkey;
alter table public.student_lesson_completions
  add constraint student_lesson_completions_confirmed_by_fkey
    foreign key (confirmed_by) references public.users(id);
