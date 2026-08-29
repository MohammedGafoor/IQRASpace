-- Universal Lesson Plans (curriculum), separate from class/session scheduling.
-- See docs/PROGRESS.md "Lesson Library redesign" and the approved plan for the
-- full rationale: a Lesson Plan is a reusable, ordered sequence of lessons
-- (e.g. "Qaida – Beginners") that any number of classes can be assigned to,
-- independent of any one class's roster or schedule.

create table lesson_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_lesson_plans_tutor ON lesson_plans(tutor_id);

-- A single ordered item in a plan ("Lesson 4 — Fathah"). `sequence` (1-based)
-- drives the recommended learning order and student progression; `prerequisite_item_id`
-- is currently informational (progression is sequence-driven), reserved for a
-- future non-linear curriculum. Material fields mirror lesson_materials'
-- shape (0001, 0011, 0012) but live directly on the item, since a curriculum
-- lesson's material isn't tied to any one scheduled session.
create table lesson_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_plan_id UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
  sequence INT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT,
  quran_surah_key TEXT,
  material_drive_file_id UUID REFERENCES google_drive_files(id),
  material_storage_path TEXT,
  material_type TEXT DEFAULT 'pdf',
  material_page_start INT,
  material_page_end INT,
  prerequisite_item_id UUID REFERENCES lesson_plan_items(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (lesson_plan_id, sequence)
);
CREATE INDEX idx_lesson_plan_items_plan ON lesson_plan_items(lesson_plan_id, sequence);

-- Which classes follow which plan. A class can be assigned at most one plan
-- (enforced by the unique index below, not the join table's own PK, so
-- re-assigning a class to a different plan is a delete+insert, not an update).
create table class_lesson_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  lesson_plan_id UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (class_id)
);
CREATE INDEX idx_class_lesson_plans_plan ON class_lesson_plans(lesson_plan_id);

ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_lesson_plans ENABLE ROW LEVEL SECURITY;
