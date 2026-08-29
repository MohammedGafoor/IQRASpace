-- Per-student progression through a Lesson Plan. Deliberately separate from
-- lesson_progress (0001, 0007), which is a skill-score journal ("recitation
-- 80%, tajweed 65%..." per lesson) — this table tracks *curriculum position*
-- ("which lesson plan item is the student on, and did a tutor confirm it").
-- A session ending does NOT advance this table; only the explicit tutor
-- confirm-completion action (below) does.

CREATE TABLE student_lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  lesson_plan_id UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
  current_item_id UUID REFERENCES lesson_plan_items(id), -- NULL once the plan is finished
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'needs_practice', 'completed', 'mastered')),
  tutor_confirmed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, lesson_plan_id)
);
CREATE INDEX idx_student_lesson_progress_student ON student_lesson_progress(student_id);
CREATE INDEX idx_student_lesson_progress_plan ON student_lesson_progress(lesson_plan_id);

-- History of every item a student has had confirmed complete — drives
-- "completed lessons" / percent-complete, independent of `current_item_id`
-- (which only tracks the single current position).
CREATE TABLE student_lesson_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  lesson_plan_item_id UUID NOT NULL REFERENCES lesson_plan_items(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL, -- the session it was confirmed in, if any
  confirmed_by UUID NOT NULL REFERENCES tutors(id),
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, lesson_plan_item_id)
);
CREATE INDEX idx_student_lesson_completions_student ON student_lesson_completions(student_id);

ALTER TABLE student_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_lesson_completions ENABLE ROW LEVEL SECURITY;
