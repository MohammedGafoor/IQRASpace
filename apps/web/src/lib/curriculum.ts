import { supabase } from "./supabaseClient";
import type { ClassLessonPlan, ClassMember, ClassRow, LessonPlan, LessonPlanItem, StudentLessonProgress } from "./types";

/**
 * A student's position in one Universal Lesson Plan, flattened for display —
 * used by the Students directory and the Progress screen so both show the
 * same "where is this student in the curriculum" summary.
 */
export type CurriculumRow = {
  planId: string;
  planName: string;
  currentTitle: string | null;
  currentSequence: number | null;
  totalActive: number;
  completedCount: number;
  status: StudentLessonProgress["status"];
};

/** The plan(s) currently assigned to classes this student belongs to — the
 * only ones that should ever surface on their curriculum screens. A
 * `student_lesson_progress` row can outlive a class's plan being reassigned
 * or the student leaving the class, so callers must filter through this
 * rather than trusting `student_lesson_progress` alone (0022_student_progress_gaps.sql
 * seeds rows correctly going forward, but doesn't retroactively clean up
 * stale rows from before a class was reassigned). */
async function getCurrentlyAssignedPlanIds(studentId: string): Promise<Set<string>> {
  const { data: memberRows } = await supabase.from("class_members").select("*").eq("student_id", studentId);
  const classIds = ((memberRows ?? []) as ClassMember[]).map((m) => m.class_id);
  if (classIds.length === 0) return new Set();

  const { data: assignRows } = await supabase
    .from("class_lesson_plans")
    .select("class_id, lesson_plan_id")
    .in("class_id", classIds);
  return new Set(((assignRows ?? []) as ClassLessonPlan[]).map((a) => a.lesson_plan_id));
}

export async function getStudentCurriculumProgress(studentId: string): Promise<CurriculumRow[]> {
  const [{ data: planProgressRows }, validPlanIds] = await Promise.all([
    supabase.from("student_lesson_progress").select("*").eq("student_id", studentId),
    getCurrentlyAssignedPlanIds(studentId),
  ]);
  const planProgress = ((planProgressRows ?? []) as StudentLessonProgress[]).filter((p) =>
    validPlanIds.has(p.lesson_plan_id)
  );
  if (planProgress.length === 0) return [];

  const planIds = Array.from(new Set(planProgress.map((p) => p.lesson_plan_id)));
  const [{ data: planRows }, { data: itemRows }, { data: completionRows }] = await Promise.all([
    supabase.from("lesson_plans").select("*").in("id", planIds),
    supabase.from("lesson_plan_items").select("*").in("lesson_plan_id", planIds),
    supabase.from("student_lesson_completions").select("lesson_plan_item_id").eq("student_id", studentId),
  ]);
  const plans = (planRows ?? []) as LessonPlan[];
  const items = (itemRows ?? []) as LessonPlanItem[];
  const completedItemIds = new Set(
    ((completionRows ?? []) as { lesson_plan_item_id: string }[]).map((c) => c.lesson_plan_item_id)
  );

  return planProgress.map((p) => {
    const planItems = items.filter((i) => i.lesson_plan_id === p.lesson_plan_id);
    const current = planItems.find((i) => i.id === p.current_item_id) ?? null;
    return {
      planId: p.lesson_plan_id,
      planName: plans.find((pl) => pl.id === p.lesson_plan_id)?.name ?? "Lesson Plan",
      currentTitle: current?.title ?? null,
      currentSequence: current?.sequence ?? null,
      totalActive: planItems.filter((i) => i.active).length,
      completedCount: planItems.filter((i) => completedItemIds.has(i.id)).length,
      status: p.status,
    };
  });
}

/** One class's curriculum context for a student: the class, the Universal
 * Lesson Plan it's assigned (if any), that plan's active items, and this
 * student's personal position in it. This is the single correct join chain —
 * Class → Plan → Items → Student Progress — every screen should read from,
 * so "which lesson plan applies to this student" is never computed two
 * different ways in two different places. */
export type StudentClassCurriculum = {
  classRow: ClassRow;
  plan: LessonPlan | null;
  items: LessonPlanItem[]; // active, sorted by sequence
  progress: StudentLessonProgress | null;
  completedItemIds: Set<string>;
};

export async function getStudentClassCurriculum(studentId: string): Promise<StudentClassCurriculum[]> {
  const { data: memberRows } = await supabase.from("class_members").select("*").eq("student_id", studentId);
  const classIds = ((memberRows ?? []) as ClassMember[]).map((m) => m.class_id);
  if (classIds.length === 0) return [];

  const [{ data: classRows }, { data: assignRows }, { data: completionRows }] = await Promise.all([
    supabase.from("classes").select("*").in("id", classIds),
    supabase.from("class_lesson_plans").select("*").in("class_id", classIds),
    supabase.from("student_lesson_completions").select("lesson_plan_item_id").eq("student_id", studentId),
  ]);
  const classes = (classRows ?? []) as ClassRow[];
  const assignments = (assignRows ?? []) as ClassLessonPlan[];
  const completedItemIds = new Set(
    ((completionRows ?? []) as { lesson_plan_item_id: string }[]).map((c) => c.lesson_plan_item_id)
  );

  const planIds = Array.from(new Set(assignments.map((a) => a.lesson_plan_id)));
  const [{ data: planRows }, { data: itemRows }, { data: progressRows }] = await Promise.all([
    planIds.length > 0
      ? supabase.from("lesson_plans").select("*").in("id", planIds)
      : Promise.resolve({ data: [] as LessonPlan[] }),
    planIds.length > 0
      ? supabase.from("lesson_plan_items").select("*").in("lesson_plan_id", planIds).eq("active", true).order("sequence")
      : Promise.resolve({ data: [] as LessonPlanItem[] }),
    planIds.length > 0
      ? supabase.from("student_lesson_progress").select("*").eq("student_id", studentId).in("lesson_plan_id", planIds)
      : Promise.resolve({ data: [] as StudentLessonProgress[] }),
  ]);
  const plans = (planRows ?? []) as LessonPlan[];
  const items = (itemRows ?? []) as LessonPlanItem[];
  const progressRowsByPlan = new Map(((progressRows ?? []) as StudentLessonProgress[]).map((p) => [p.lesson_plan_id, p]));

  return classes.map((classRow) => {
    const assignment = assignments.find((a) => a.class_id === classRow.id) ?? null;
    const plan = assignment ? plans.find((p) => p.id === assignment.lesson_plan_id) ?? null : null;
    const planItems = plan ? items.filter((i) => i.lesson_plan_id === plan.id) : [];
    return {
      classRow,
      plan,
      items: planItems,
      progress: plan ? progressRowsByPlan.get(plan.id) ?? null : null,
      completedItemIds,
    };
  });
}

/** Batched lookup of each student's current lesson (across all their classes'
 * assigned plans) — one round trip per table, not one per student, for grids
 * like the Students directory. Only the first assigned-plan match per student
 * is returned (mirrors the "at most one plan per class" model; a student in
 * multiple classes with different plans is an edge case the detail view
 * handles fully via getStudentClassCurriculum). */
export type CurrentLessonInfo = { plan: LessonPlan; item: LessonPlanItem | null };

export async function getBulkCurrentLessonItems(studentIds: string[]): Promise<Map<string, CurrentLessonInfo>> {
  const result = new Map<string, CurrentLessonInfo>();
  if (studentIds.length === 0) return result;

  const { data: memberRows } = await supabase.from("class_members").select("*").in("student_id", studentIds);
  const members = (memberRows ?? []) as ClassMember[];
  const classIds = Array.from(new Set(members.map((m) => m.class_id)));
  if (classIds.length === 0) return result;

  const { data: assignRows } = await supabase.from("class_lesson_plans").select("*").in("class_id", classIds);
  const assignments = (assignRows ?? []) as ClassLessonPlan[];
  const planIds = Array.from(new Set(assignments.map((a) => a.lesson_plan_id)));
  if (planIds.length === 0) return result;

  const [{ data: planRows }, { data: progressRows }] = await Promise.all([
    supabase.from("lesson_plans").select("*").in("id", planIds),
    supabase.from("student_lesson_progress").select("*").in("student_id", studentIds).in("lesson_plan_id", planIds),
  ]);
  const plans = new Map(((planRows ?? []) as LessonPlan[]).map((p) => [p.id, p]));
  const progressRowsList = (progressRows ?? []) as StudentLessonProgress[];

  const currentItemIds = Array.from(new Set(progressRowsList.map((p) => p.current_item_id).filter((id): id is string => !!id)));
  const { data: itemRows } =
    currentItemIds.length > 0
      ? await supabase.from("lesson_plan_items").select("*").in("id", currentItemIds)
      : { data: [] as LessonPlanItem[] };
  const itemsById = new Map(((itemRows ?? []) as LessonPlanItem[]).map((i) => [i.id, i]));

  const planIdByClass = new Map(assignments.map((a) => [a.class_id, a.lesson_plan_id]));
  for (const studentId of studentIds) {
    const studentClassIds = members.filter((m) => m.student_id === studentId).map((m) => m.class_id);
    const assignedClassId = studentClassIds.find((cid) => planIdByClass.has(cid));
    if (!assignedClassId) continue;
    const planId = planIdByClass.get(assignedClassId)!;
    const plan = plans.get(planId);
    if (!plan) continue;
    const progress = progressRowsList.find((p) => p.lesson_plan_id === planId);
    const item = progress?.current_item_id ? itemsById.get(progress.current_item_id) ?? null : null;
    result.set(studentId, { plan, item });
  }
  return result;
}

// ── Mutations: all write only to student_lesson_progress /
// student_lesson_completions — never to lesson_plans/lesson_plan_items, so a
// tutor correcting one student's position never touches the shared
// curriculum. ────────────────────────────────────────────────────────────

export async function setStudentCurrentItem(
  studentId: string,
  lessonPlanId: string,
  itemId: string,
  status: StudentLessonProgress["status"] = "in_progress"
) {
  return supabase.from("student_lesson_progress").upsert(
    {
      student_id: studentId,
      lesson_plan_id: lessonPlanId,
      current_item_id: itemId,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,lesson_plan_id" }
  );
}

export async function updateStudentProgressNotes(studentId: string, lessonPlanId: string, notes: string) {
  return supabase
    .from("student_lesson_progress")
    .update({ notes: notes || null, updated_at: new Date().toISOString() })
    .eq("student_id", studentId)
    .eq("lesson_plan_id", lessonPlanId);
}

/** Seeds a starting-point progress row (Lesson 1, not started) for a student
 * whose class already has a plan assigned but who has no progress row yet —
 * covers legacy data from before 0022_student_progress_gaps.sql's triggers. */
export async function assignStudentStartingLesson(studentId: string, lessonPlanId: string, items: LessonPlanItem[]) {
  const firstItem = items.slice().sort((a, b) => a.sequence - b.sequence)[0];
  if (!firstItem) return { error: new Error("This plan has no active lessons yet.") };
  return setStudentCurrentItem(studentId, lessonPlanId, firstItem.id, "not_started");
}

/** Confirms `item` complete for one student and advances them to the next
 * active item in sequence (or marks the plan mastered if none remain) — the
 * same logic ConfirmLessonCompletionModal uses, factored out so it also works
 * with no scheduled session (`lessonId: null` — student_lesson_completions.lesson_id
 * is nullable exactly for this). */
export async function confirmStudentLessonCompleted(
  studentId: string,
  tutorId: string,
  item: LessonPlanItem,
  opts?: { lessonId?: string | null; notes?: string | null }
): Promise<{ error: Error | null; nextItem: { id: string; title: string } | null }> {
  const { data: nextItem } = await supabase
    .from("lesson_plan_items")
    .select("id, title")
    .eq("lesson_plan_id", item.lesson_plan_id)
    .eq("active", true)
    .gt("sequence", item.sequence)
    .order("sequence", { ascending: true })
    .limit(1)
    .maybeSingle();

  const progressUpdate = await supabase.from("student_lesson_progress").upsert(
    {
      student_id: studentId,
      lesson_plan_id: item.lesson_plan_id,
      current_item_id: nextItem?.id ?? null,
      status: nextItem ? "not_started" : "mastered",
      tutor_confirmed: false,
      completed_at: null,
      notes: opts?.notes ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,lesson_plan_id" }
  );
  if (progressUpdate.error) return { error: progressUpdate.error, nextItem: nextItem ?? null };

  const completionInsert = await supabase.from("student_lesson_completions").upsert(
    {
      student_id: studentId,
      lesson_plan_item_id: item.id,
      lesson_id: opts?.lessonId ?? null,
      confirmed_by: tutorId,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "student_id,lesson_plan_item_id" }
  );
  return { error: completionInsert.error, nextItem: nextItem ?? null };
}
