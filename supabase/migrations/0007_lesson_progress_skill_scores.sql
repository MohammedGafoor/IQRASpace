-- Expanded Phase 1 scope: the Student Progress screen shows three skill
-- scores (recitation / tajweed / memorization) per lesson so a tutor can
-- track a trend over time; the latest non-null value per skill drives the
-- progress bars shown on the Progress and Student Profile screens.

ALTER TABLE lesson_progress
  ADD COLUMN recitation_score INT CHECK (recitation_score BETWEEN 0 AND 100),
  ADD COLUMN tajweed_score INT CHECK (tajweed_score BETWEEN 0 AND 100),
  ADD COLUMN memorization_score INT CHECK (memorization_score BETWEEN 0 AND 100),
  ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
