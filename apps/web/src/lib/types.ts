// Domain types mirroring supabase/migrations/0001_init_schema.sql (architecture §13).
// Kept hand-written rather than generated (`supabase gen types`) for Phase 1 —
// worth switching to generated types once the schema stabilizes past Phase 1.

export type Role = "tutor" | "student" | "guardian";

export type AppUser = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  created_at: string;
};

export type ClassRow = {
  id: string;
  tutor_id: string;
  name: string;
  created_at: string;
};

export type ClassMember = {
  id: string;
  class_id: string;
  student_id: string;
  joined_at: string;
};

export type LessonStatus = "scheduled" | "active" | "completed" | "cancelled";

export type Lesson = {
  id: string;
  class_id: string;
  tutor_id: string;
  title: string;
  lesson_date: string; // ISO date (YYYY-MM-DD)
  status: LessonStatus;
};
