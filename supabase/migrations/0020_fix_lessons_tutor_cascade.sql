-- Bug fix, found while cleaning up test accounts (Phase 3): every other
-- `tutor_id -> tutors(id)` FK (classes, lesson_plans, google_drive_files)
-- was declared `ON DELETE CASCADE` in 0001/0013, but `lessons.tutor_id` was
-- not — deleting a tutor with any lesson row failed with
-- "violates foreign key constraint lessons_tutor_id_fkey" even though the
-- lesson's own class_id -> classes(id) cascade would otherwise have cleaned
-- it up. This affects both the one-off cleanup script and, going forward,
-- admin-user-management's "delete" action for any tutor who has taught a
-- lesson.
alter table public.lessons drop constraint lessons_tutor_id_fkey;
alter table public.lessons add constraint lessons_tutor_id_fkey
  foreign key (tutor_id) references public.tutors(id) on delete cascade;
