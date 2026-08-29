-- Expanded Phase 1 scope: the Settings screen's "Lesson Settings" and
-- "Notifications" cards need somewhere real to persist to, per-tutor.

ALTER TABLE tutors
  ADD COLUMN default_lesson_duration_minutes INT NOT NULL DEFAULT 45,
  ADD COLUMN default_reminder_minutes INT NOT NULL DEFAULT 15,
  ADD COLUMN email_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN lesson_start_reminders_enabled BOOLEAN NOT NULL DEFAULT true;
