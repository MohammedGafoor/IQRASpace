import { supabase } from "./supabaseClient";
import { getStudentClassCurriculum } from "./curriculum";
import type { Lesson, RecurringSessionRule } from "./types";

const DEFAULT_WEEKS_AHEAD = 8;

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Materializes a RecurringSessionRule into concrete `lessons` rows for the
 * next `weeksAhead` (a fixed batch generated up front — this app has no
 * cron/background-job infrastructure to generate occurrences lazily).
 * Idempotent: skips any date the student already has a session on. Called
 * once when a rule is created, and again from a "Generate more" action to
 * top up further.
 */
export async function generateSessionsForRule(
  rule: RecurringSessionRule,
  weeksAhead: number = DEFAULT_WEEKS_AHEAD
): Promise<{ created: number; error: Error | null }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startsOn = new Date(`${rule.starts_on}T00:00:00`);
  const rangeStart = startsOn > today ? startsOn : today;

  const rangeEndByWeeks = new Date(today);
  rangeEndByWeeks.setDate(rangeEndByWeeks.getDate() + weeksAhead * 7);
  const rangeEnd = rule.ends_on
    ? new Date(Math.min(rangeEndByWeeks.getTime(), new Date(`${rule.ends_on}T00:00:00`).getTime()))
    : rangeEndByWeeks;

  const candidateDates: string[] = [];
  for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    if (rule.days_of_week.includes(d.getDay())) candidateDates.push(toISODate(d));
  }
  if (candidateDates.length === 0) return { created: 0, error: null };

  const { data: existingRows } = await supabase
    .from("lessons")
    .select("lesson_date")
    .eq("student_id", rule.student_id)
    .in("lesson_date", candidateDates);
  const existingDates = new Set(((existingRows ?? []) as Pick<Lesson, "lesson_date">[]).map((r) => r.lesson_date));
  const datesToCreate = candidateDates.filter((d) => !existingDates.has(d));
  if (datesToCreate.length === 0) return { created: 0, error: null };

  // Best-effort snapshot of the student's current lesson at generation time
  // — a reference for the Teach screen, not authoritative (student_lesson_progress
  // stays the source of truth and can move on well before a future session).
  const curriculum = await getStudentClassCurriculum(rule.student_id);
  const classCurriculum = curriculum.find((c) => c.classRow.id === rule.class_id);
  const currentItem = classCurriculum?.items.find((i) => i.id === classCurriculum.progress?.current_item_id) ?? null;

  const rows = datesToCreate.map((lesson_date) => ({
    student_id: rule.student_id,
    class_id: rule.class_id,
    tutor_id: rule.tutor_id,
    title: "Session",
    lesson_date,
    start_time: rule.start_time,
    duration_minutes: rule.duration_minutes,
    status: "scheduled" as const,
    quran_surah_key: currentItem?.quran_surah_key ?? null,
    lesson_plan_item_id: currentItem?.id ?? null,
    recurring_rule_id: rule.id,
  }));

  const { error } = await supabase.from("lessons").insert(rows);
  return { created: error ? 0 : rows.length, error };
}
