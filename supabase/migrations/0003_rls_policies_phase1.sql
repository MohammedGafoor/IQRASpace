-- RLS policies for the tables Phase 1 (Core CRUD) touches: users, tutors,
-- students, classes, class_members, lessons. RLS was already enabled
-- (deny-by-default) in 0001; this migration adds the actual grants.
--
-- Per architecture §16, this is normally scoped to the Phase 6 "Polish +
-- Security pass". It's pulled forward and done incrementally, table-by-table,
-- because RLS was turned on from day one (see docs/PROGRESS.md Phase 0) —
-- without policies, Phase 1's CRUD literally cannot read or write anything.
-- Phase 6 becomes an audit/hardening pass over these policies rather than
-- writing them from scratch.

-- ── users ────────────────────────────────────────────────────────────────
create policy "users_select_own" on public.users
  for select using (id = auth.uid());

-- Lets a tutor see the profile of a student already in one of their classes
-- (e.g. to show a name in a roster). Deliberately does NOT let a tutor browse
-- arbitrary student profiles — see add_student_to_class() below for how
-- "add by email" works without that broad read access.
create policy "users_select_as_tutor_of_student" on public.users
  for select using (
    role = 'student'
    and exists (
      select 1
      from public.class_members cm
      join public.classes c on c.id = cm.class_id
      where cm.student_id = public.users.id
        and c.tutor_id = auth.uid()
    )
  );

create policy "users_update_own" on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ── tutors ───────────────────────────────────────────────────────────────
create policy "tutors_select_own" on public.tutors
  for select using (id = auth.uid());

create policy "tutors_update_own" on public.tutors
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ── students ─────────────────────────────────────────────────────────────
create policy "students_select_own" on public.students
  for select using (id = auth.uid());

create policy "students_select_as_tutor" on public.students
  for select using (
    exists (
      select 1
      from public.class_members cm
      join public.classes c on c.id = cm.class_id
      where cm.student_id = public.students.id
        and c.tutor_id = auth.uid()
    )
  );

create policy "students_update_own" on public.students
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ── classes ──────────────────────────────────────────────────────────────
create policy "classes_tutor_all" on public.classes
  for all using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());

create policy "classes_student_select" on public.classes
  for select using (
    exists (
      select 1 from public.class_members cm
      where cm.class_id = public.classes.id
        and cm.student_id = auth.uid()
    )
  );

-- ── class_members ────────────────────────────────────────────────────────
create policy "class_members_tutor_all" on public.class_members
  for all using (
    exists (
      select 1 from public.classes c
      where c.id = class_members.class_id and c.tutor_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.classes c
      where c.id = class_members.class_id and c.tutor_id = auth.uid()
    )
  );

create policy "class_members_student_select" on public.class_members
  for select using (student_id = auth.uid());

-- ── lessons ──────────────────────────────────────────────────────────────
create policy "lessons_tutor_all" on public.lessons
  for all using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());

create policy "lessons_student_select" on public.lessons
  for select using (
    exists (
      select 1 from public.class_members cm
      where cm.class_id = public.lessons.class_id
        and cm.student_id = auth.uid()
    )
  );

-- ── add_student_to_class RPC ─────────────────────────────────────────────
-- "Assign students to classes" (architecture §2) needs a tutor to find an
-- existing student account by email. Rather than a broad "tutors can read
-- any student profile" policy (a real privacy leak for a minors-heavy user
-- base, see §16), this is a narrow SECURITY DEFINER function: it looks up
-- the email server-side, checks the caller actually owns the target class,
-- and inserts the membership — the tutor never receives the student's full
-- profile, only success/failure.
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
  ) then
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

grant execute on function public.add_student_to_class(uuid, text) to authenticated;
