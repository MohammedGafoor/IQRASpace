import { supabase } from "./supabaseClient";
import type { LessonPlan, LessonPlanItem, StudentLessonProgress } from "./types";

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

export async function getStudentCurriculumProgress(studentId: string): Promise<CurriculumRow[]> {
  const { data: planProgressRows } = await supabase
    .from("student_lesson_progress")
    .select("*")
    .eq("student_id", studentId);
  const planProgress = (planProgressRows ?? []) as StudentLessonProgress[];
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
