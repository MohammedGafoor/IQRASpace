-- A scheduled class/session may now say *which* Universal Lesson Plan item
-- it's teaching. Nullable and additive only — every existing lessons column
-- (lesson_date, start_time, duration_minutes, status, quran_surah_key) keeps
-- its exact current meaning; only the Lesson Library UI stops managing them,
-- the Schedule/session-create flow still does.

ALTER TABLE lessons
  ADD COLUMN lesson_plan_item_id UUID REFERENCES lesson_plan_items(id);
