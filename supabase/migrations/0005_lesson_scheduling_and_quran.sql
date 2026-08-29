-- Expanded Phase 1 scope (see docs/PROGRESS.md): the tutor demo's Schedule
-- and Teach/Share screens need a lesson to carry a time-of-day (not just a
-- date), a duration, and a pointer to which bundled Qur'an surah its live
-- highlight-sharing screen should use.

ALTER TABLE lessons
  ADD COLUMN start_time TIME,
  ADD COLUMN duration_minutes INT NOT NULL DEFAULT 45,
  ADD COLUMN quran_surah_key TEXT;
