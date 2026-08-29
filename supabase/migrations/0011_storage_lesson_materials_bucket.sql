-- Storage bucket for direct PDF upload (architecture §8's "simpler fallback,
-- recommended for the very first MVP cut" — skips Drive OAuth entirely).
-- Path convention: lesson-materials/{tutor_id}/{filename}.
--
-- Tradeoff, documented rather than silently made: write access (insert/
-- update/delete) is restricted to the caller's own tutor-id folder, but
-- *read* access is open to any authenticated user rather than re-deriving
-- the lesson_materials -> lesson -> class_members chain in a storage policy.
-- These are lesson handout PDFs, not personal student data, and the doubled
-- join complexity isn't worth it at this scale — revisit if that changes.

insert into storage.buckets (id, name, public, file_size_limit)
values ('lesson-materials', 'lesson-materials', false, 52428800)
on conflict (id) do nothing;

create policy "lesson_materials_bucket_tutor_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'lesson-materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "lesson_materials_bucket_tutor_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'lesson-materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "lesson_materials_bucket_tutor_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'lesson-materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "lesson_materials_bucket_authenticated_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'lesson-materials');
