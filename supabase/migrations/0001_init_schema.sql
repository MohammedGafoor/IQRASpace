-- Initial schema for IQRASpace / Quranic Teacher
-- Source: docs/architecture.md §12 (ER diagram) and §13 (DDL)
-- Phase: 0 (Foundation) — RLS policies are added in a later migration (Phase 6 / Security),
-- but every table gets RLS *enabled* here with a deny-by-default posture so the hosted
-- project is never left wide open between now and the security pass.

-- Core identity
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('tutor','student','guardian')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tutors (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  google_refresh_token_enc TEXT  -- encrypted at rest, server-side only
);

CREATE TABLE students (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  guardian_id UUID REFERENCES users(id),
  date_of_birth DATE
);

-- Classes & membership
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_classes_tutor ON classes(tutor_id);

CREATE TABLE class_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (class_id, student_id)
);
CREATE INDEX idx_class_members_class ON class_members(class_id);
CREATE INDEX idx_class_members_student ON class_members(student_id);

-- Lessons & materials
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  tutor_id UUID NOT NULL REFERENCES tutors(id),
  title TEXT NOT NULL,
  lesson_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','active','completed','cancelled'))
);
CREATE INDEX idx_lessons_class_date ON lessons(class_id, lesson_date);

CREATE TABLE google_drive_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  drive_file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  web_view_link TEXT,
  linked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tutor_id, drive_file_id)
);

CREATE TABLE lesson_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  drive_file_id UUID REFERENCES google_drive_files(id),
  storage_path TEXT,        -- alternative: file uploaded directly to Supabase Storage
  material_type TEXT DEFAULT 'pdf'
);
CREATE INDEX idx_lesson_materials_lesson ON lesson_materials(lesson_id);

-- Meetings & attendance
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  meet_url TEXT NOT NULL,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  calendar_event_id TEXT
);
CREATE INDEX idx_meetings_lesson ON meetings(lesson_id);

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
  marked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (lesson_id, student_id)
);
CREATE INDEX idx_attendance_student ON attendance(student_id);

-- Progress, notes
CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  progress_note TEXT,
  surah_ayah_range TEXT
);
CREATE INDEX idx_progress_student ON lesson_progress(student_id);

CREATE TABLE lesson_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Live sharing
CREATE TABLE sharing_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE highlighted_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sharing_session_id UUID NOT NULL REFERENCES sharing_sessions(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  highlight_type TEXT NOT NULL CHECK (highlight_type IN ('rect','text','ayah')),
  coordinates JSONB NOT NULL,   -- {x,y,width,height} normalized 0-1
  selected_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_highlight_session ON highlighted_content(sharing_session_id);

-- Deny-by-default RLS posture (Phase 0 placeholder).
-- Enabling RLS with no policies means NO client-side row is readable/writable
-- until real policies are added in the Phase 6 security migration; the
-- service_role key (used only from Edge Functions / trusted server code)
-- bypasses RLS entirely, so server-side work is unaffected in the meantime.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutors ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_drive_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlighted_content ENABLE ROW LEVEL SECURITY;
