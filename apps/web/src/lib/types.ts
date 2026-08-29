// Domain types mirroring supabase/migrations/*.sql (architecture §13 + the
// expanded Phase 1 migrations 0005-0011, see docs/PROGRESS.md).
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

/**
 * A tutor's own settings row. Deliberately never includes
 * `google_refresh_token_enc` — every query against `tutors` in client code
 * should explicitly `.select()` only the columns below, never `select("*")`,
 * so the encrypted token can never end up in the browser.
 */
export type TutorProfile = {
  id: string;
  bio: string | null;
  default_lesson_duration_minutes: number;
  default_reminder_minutes: number;
  email_reminders_enabled: boolean;
  lesson_start_reminders_enabled: boolean;
};

export type StudentProfile = {
  id: string;
  guardian_id: string | null;
  date_of_birth: string | null;
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
  start_time: string | null; // "HH:MM:SS"
  duration_minutes: number;
  /** Which bundled surah (lib/quranContent.ts) this lesson's Teach/Share screen uses, if any. */
  quran_surah_key: string | null;
  /** Which Universal Lesson Plan item this session is teaching, if any (see LessonPlanItem). */
  lesson_plan_item_id: string | null;
};

export type GoogleDriveFile = {
  id: string;
  tutor_id: string;
  drive_file_id: string;
  file_name: string;
  web_view_link: string | null;
  linked_at: string;
};

export type MaterialType = "pdf" | "drive";

export type LessonMaterial = {
  id: string;
  lesson_id: string;
  drive_file_id: string | null;
  storage_path: string | null;
  material_type: MaterialType | string;
  /** Which pages of the material this lesson focuses on (e.g. Qaida curriculum), if any. */
  page_start: number | null;
  page_end: number | null;
};

export type Meeting = {
  id: string;
  lesson_id: string;
  meet_url: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  calendar_event_id: string | null;
};

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export type AttendanceRecord = {
  id: string;
  lesson_id: string;
  student_id: string;
  status: AttendanceStatus;
  marked_at: string;
};

export type LessonProgress = {
  id: string;
  lesson_id: string;
  student_id: string;
  progress_note: string | null;
  surah_ayah_range: string | null;
  recitation_score: number | null;
  tajweed_score: number | null;
  memorization_score: number | null;
  created_at: string;
};

export type LessonNote = {
  id: string;
  lesson_id: string;
  note: string | null;
  covered: string | null;
  performance_note: string | null;
  next_lesson_plan: string | null;
  created_at: string;
};

export type SharingSessionStatus = "active" | "ended";

export type SharingSession = {
  id: string;
  lesson_id: string;
  status: SharingSessionStatus;
  started_at: string;
  ended_at: string | null;
};

export type HighlightContentType = "rect" | "text" | "ayah";

export type HighlightedContent = {
  id: string;
  sharing_session_id: string;
  page_number: number;
  highlight_type: HighlightContentType;
  coordinates: { x: number; y: number; width: number; height: number };
  selected_text: string | null;
  created_at: string;
};

/**
 * Universal Lesson Plan (curriculum), separate from class/session scheduling
 * (see supabase/migrations/0013-0016 and the Lesson Library redesign). A plan
 * is a reusable, ordered sequence of lessons a tutor defines once and can
 * assign to any number of classes via ClassLessonPlan.
 */
export type LessonPlan = {
  id: string;
  tutor_id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
};

export type LessonPlanItem = {
  id: string;
  lesson_plan_id: string;
  sequence: number;
  title: string;
  objective: string | null;
  quran_surah_key: string | null;
  material_drive_file_id: string | null;
  material_storage_path: string | null;
  material_type: MaterialType | string | null;
  material_page_start: number | null;
  material_page_end: number | null;
  prerequisite_item_id: string | null;
  active: boolean;
  created_at: string;
};

/** Which plan a class currently follows — at most one per class. */
export type ClassLessonPlan = {
  id: string;
  class_id: string;
  lesson_plan_id: string;
  assigned_at: string;
};

export type StudentProgressStatus = "not_started" | "in_progress" | "needs_practice" | "completed" | "mastered";

/** A student's own position in a shared Lesson Plan — never advanced just
 * because a session ended, only via an explicit tutor confirmation. */
export type StudentLessonProgress = {
  id: string;
  student_id: string;
  lesson_plan_id: string;
  current_item_id: string | null; // null once the plan is finished
  status: StudentProgressStatus;
  tutor_confirmed: boolean;
  completed_at: string | null;
  notes: string | null;
  updated_at: string;
};

/** History of every plan item a student has had confirmed complete — drives
 * "completed lessons" / percent-complete, independent of `current_item_id`. */
export type StudentLessonCompletion = {
  id: string;
  student_id: string;
  lesson_plan_item_id: string;
  lesson_id: string | null;
  confirmed_by: string;
  completed_at: string;
};

export type NotificationType =
  | "lesson_scheduled"
  | "attendance_marked"
  | "lesson_note_added"
  | "sharing_started"
  | "lesson_plan_advanced"
  | "system";

export type AppNotification = {
  id: string;
  user_id: string;
  type: NotificationType | string;
  title: string;
  body: string | null;
  related_lesson_id: string | null;
  read: boolean;
  created_at: string;
};
