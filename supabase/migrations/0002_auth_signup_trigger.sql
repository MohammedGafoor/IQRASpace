-- Glue between Supabase Auth (auth.users) and our domain tables (public.users/
-- tutors/students). The architecture doc's DDL (§13) doesn't specify this wiring,
-- but without it public.users has no way to ever get populated from a real signup.
--
-- Convention: public.users.id == auth.users.id. Role and full name are passed in
-- at signUp() time via options.data (-> auth.users.raw_user_meta_data) and copied
-- into public.users/tutors/students by this trigger. Runs as SECURITY DEFINER so
-- it can write to public.* despite RLS being enabled on every table.

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
  v_full_name := coalesce(new.raw_user_meta_data ->> 'full_name', new.email);

  insert into public.users (id, email, full_name, role)
  values (new.id, new.email, v_full_name, v_role);

  if v_role = 'tutor' then
    insert into public.tutors (id) values (new.id);
  elsif v_role = 'student' then
    insert into public.students (id) values (new.id);
  end if;
  -- 'guardian' role: users row only for now — no dedicated guardians table yet
  -- (Parent/Guardian portal is a Phase 2 fast-follow per architecture §4/§17).

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
