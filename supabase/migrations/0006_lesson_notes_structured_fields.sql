-- Expanded Phase 1 scope: the Lesson Notes screen captures three distinct
-- prompts (what was covered / student performance / plan for next lesson)
-- rather than one freeform note. `note` becomes an optional catch-all;
-- existing rows are unaffected.

ALTER TABLE lesson_notes
  ALTER COLUMN note DROP NOT NULL,
  ADD COLUMN covered TEXT,
  ADD COLUMN performance_note TEXT,
  ADD COLUMN next_lesson_plan TEXT;
