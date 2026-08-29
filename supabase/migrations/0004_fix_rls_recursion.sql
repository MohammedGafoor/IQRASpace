-- Fix: 0003's policies on `classes` and `class_members` cross-reference each
-- other (classes_student_select queries class_members, class_members_tutor_all
-- queries classes), which Postgres detects as infinite RLS recursion
-- (42P17) the moment either table is queried by an authenticated user.
--
-- Standard fix: move the cross-table checks into STABLE, SECURITY DEFINER
-- helper functions. Owned by the migration role (which has BYPASSRLS), so
-- calling them from inside a policy does not re-trigger RLS on the table the
-- function reads internally — breaking the cycle. Same treatment applied to
-- the two other policies that had the identical shape (users/students
-- checking tutor-of-student via a class_members/classes join).

create or replace function public.is_tutor_of_class(p_class_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.classes
    where id = p_class_id and tutor_id = auth.uid()
  );
$$;

create or replace function public.is_member_of_class(p_class_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.class_members
    where class_id = p_class_id and student_id = auth.uid()
  );
$$;

create or replace function public.is_tutor_of_student(p_student_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.class_members cm
    join public.classes c on c.id = cm.class_id
    where cm.student_id = p_student_id and c.tutor_id = auth.uid()
  );
$$;

grant execute on function public.is_tutor_of_class(uuid) to authenticated;
grant execute on function public.is_member_of_class(uuid) to authenticated;
grant execute on function public.is_tutor_of_student(uuid) to authenticated;

-- Rebuild the recursive policies to call the helpers instead of joining
-- across tables directly.

drop policy if exists "classes_student_select" on public.classes;
create policy "classes_student_select" on public.classes
  for select using (public.is_member_of_class(id));

drop policy if exists "class_members_tutor_all" on public.class_members;
create policy "class_members_tutor_all" on public.class_members
  for all
  using (public.is_tutor_of_class(class_id))
  with check (public.is_tutor_of_class(class_id));

drop policy if exists "lessons_student_select" on public.lessons;
create policy "lessons_student_select" on public.lessons
  for select using (public.is_member_of_class(class_id));

drop policy if exists "users_select_as_tutor_of_student" on public.users;
create policy "users_select_as_tutor_of_student" on public.users
  for select using (role = 'student' and public.is_tutor_of_student(id));

drop policy if exists "students_select_as_tutor" on public.students;
create policy "students_select_as_tutor" on public.students
  for select using (public.is_tutor_of_student(id));
