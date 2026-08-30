-- Student-based one-to-one scheduling. Scheduling was class-based
-- (CreateLessonForm booked "when a tutor meets a class"), but this app's
-- real workflow is one-to-one: a class can hold several students (confirmed
-- live at migration time — one class had 5 members), each progressing
-- through the shared curriculum at their own pace. A session is really
-- "tutor meets *this* student," not "tutor meets the class."
--
-- `class_id`/`tutor_id` stay on `lessons` unchanged (still required, still
-- auto-derived client-side from the chosen student) so every existing RLS
-- policy and every table FK'd to lessons(id) — attendance, lesson_materials,
-- meetings, lesson_notes, lesson_progress, sharing_sessions,
-- highlighted_content — keeps working with zero changes.
--
-- Confirmed live before writing this: `lessons` has 0 rows, so `student_id`
-- can be added NOT NULL directly, no backfill needed.

alter table public.lessons
  add column student_id uuid not null references public.students(id) on delete cascade;
create index idx_lessons_student on public.lessons(student_id);

-- ── Recurring session rules ────────────────────────────────────────────────
-- A rule describes a recurring one-to-one slot ("Ahmed, Sun/Tue/Thu 6pm,
-- 20min"); generateSessionsForRule() (lib/recurringSessions.ts) materializes
-- it into concrete `lessons` rows up front (a fixed batch, ~8 weeks) rather
-- than requiring cron/background-job infrastructure this app doesn't have.
-- `class_id` is carried for the same reason as on `lessons` — reuse existing
-- RLS helpers unchanged.
create table public.recurring_session_rules (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  days_of_week int[] not null, -- 0=Sunday .. 6=Saturday
  start_time time not null,
  duration_minutes int not null default 20,
  active boolean not null default true,
  starts_on date not null default current_date,
  ends_on date, -- null = indefinite
  created_at timestamptz default now()
);
create index idx_recurring_rules_tutor on public.recurring_session_rules(tutor_id);
create index idx_recurring_rules_student on public.recurring_session_rules(student_id);

alter table public.lessons
  add column recurring_rule_id uuid references public.recurring_session_rules(id) on delete set null;

alter table public.recurring_session_rules enable row level security;

-- Same is_tutor_of_class()/is_member_of_class() convention as every other
-- class-scoped table (0003/0010/0013/0016).
create policy "recurring_session_rules_tutor_all" on public.recurring_session_rules
  for all using (public.is_tutor_of_class(class_id)) with check (public.is_tutor_of_class(class_id));

create policy "recurring_session_rules_student_select" on public.recurring_session_rules
  for select using (public.is_member_of_class(class_id));

create policy "recurring_session_rules_all_as_admin" on public.recurring_session_rules
  for all using (public.is_admin()) with check (public.is_admin());

-- ── Default session duration: 20 minutes, the one-to-one standard ─────────
-- Only rows still at the untouched factory default (45) are bumped — a
-- tutor who already customized their own value (confirmed live: the one
-- existing tutor is at 30) keeps their explicit choice.
alter table public.tutors alter column default_lesson_duration_minutes set default 20;
update public.tutors set default_lesson_duration_minutes = 20 where default_lesson_duration_minutes = 45;
