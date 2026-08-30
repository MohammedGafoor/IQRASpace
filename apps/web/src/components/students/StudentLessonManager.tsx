"use client";

import { useCallback, useEffect, useState } from "react";
import {
  assignStudentStartingLesson,
  confirmStudentLessonCompleted,
  getStudentClassCurriculum,
  setStudentCurrentItem,
  updateStudentProgressNotes,
  type StudentClassCurriculum,
} from "@/lib/curriculum";
import { notifyUser } from "@/lib/notifications";
import type { LessonPlanItem } from "@/lib/types";
import { Card, Eyebrow } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useLessonMaterialViewer } from "./LessonMaterialViewer";

/**
 * Per-student curriculum manager: view/change the student's current lesson,
 * mark it complete (advancing them), see completed lessons, launch the
 * current lesson's material, and leave progress notes — all scoped to
 * `student_lesson_progress`/`student_lesson_completions`. Never writes to
 * `lesson_plans`/`lesson_plan_items` (the Universal curriculum), so this is
 * safe to expose to any tutor managing their own students.
 *
 * Used from both the Students card detail modal and the Student Progress
 * page, so "how a tutor manages one student's lesson" only exists once.
 */
export function StudentLessonManager({
  studentId,
  tutorId,
  canManage,
  onChanged,
}: {
  studentId: string;
  tutorId: string;
  canManage: boolean;
  onChanged?: () => void;
}) {
  const { openItem, modal } = useLessonMaterialViewer();
  const [rows, setRows] = useState<StudentClassCurriculum[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await getStudentClassCurriculum(studentId);
    setRows(data);
    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    load();
  }, [load]);

  if (loading) return <p className="text-sm text-muted">Loading curriculum…</p>;

  const withPlans = rows.filter((r) => r.plan);
  if (withPlans.length === 0) {
    return (
      <Card>
        <EmptyState icon="📖">
          No lesson plan assigned yet — assign this student&rsquo;s class to a Universal Lesson Plan from Lessons.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {withPlans.map((row) => (
        <ClassCurriculumCard
          key={row.classRow.id}
          row={row}
          studentId={studentId}
          tutorId={tutorId}
          canManage={canManage}
          onLaunch={openItem}
          onChanged={() => {
            load();
            onChanged?.();
          }}
        />
      ))}
      {modal}
    </div>
  );
}

function ClassCurriculumCard({
  row,
  studentId,
  tutorId,
  canManage,
  onLaunch,
  onChanged,
}: {
  row: StudentClassCurriculum;
  studentId: string;
  tutorId: string;
  canManage: boolean;
  onLaunch: (item: LessonPlanItem) => void;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const { classRow, plan, items, progress, completedItemIds } = row;
  const [notes, setNotes] = useState(progress?.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotes(progress?.notes ?? "");
  }, [progress?.notes]);

  if (!plan) return null;

  const currentItem = items.find((i) => i.id === progress?.current_item_id) ?? null;
  const completedItems = items.filter((i) => completedItemIds.has(i.id)).sort((a, b) => a.sequence - b.sequence);

  async function handleAssignStart() {
    setBusy(true);
    const { error } = await assignStudentStartingLesson(studentId, plan!.id, items);
    setBusy(false);
    if (error) showToast(error.message);
    else {
      showToast("Assigned Lesson 1");
      onChanged();
    }
  }

  async function handleChangeLesson(itemId: string) {
    if (!itemId) return;
    setBusy(true);
    const { error } = await setStudentCurrentItem(studentId, plan!.id, itemId);
    setBusy(false);
    if (error) showToast(error.message);
    else {
      showToast("Current lesson updated");
      onChanged();
    }
  }

  async function handleMarkCompleted() {
    if (!currentItem) return;
    setBusy(true);
    const { error, nextItem } = await confirmStudentLessonCompleted(studentId, tutorId, currentItem, {
      notes: notes || null,
    });
    setBusy(false);
    if (error) {
      showToast(error.message);
      return;
    }
    await notifyUser({
      userId: studentId,
      type: "lesson_plan_advanced",
      title: nextItem ? "Lesson completed — moving on" : "Curriculum completed! 🎉",
      body: nextItem
        ? `"${currentItem.title}" confirmed complete. Next up: ${nextItem.title}.`
        : `"${currentItem.title}" confirmed complete — you've finished this curriculum!`,
    });
    showToast(nextItem ? "Marked complete — moved to next lesson" : "Marked complete — plan finished 🎉");
    onChanged();
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    const { error } = await updateStudentProgressNotes(studentId, plan!.id, notes);
    setSavingNotes(false);
    if (error) showToast(error.message);
    else showToast("Notes saved");
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow>{classRow.name}</Eyebrow>
          <h4 className="text-base font-semibold">{plan.name}</h4>
        </div>
        <Badge tone={progress?.status === "mastered" ? "green" : "teal"}>
          {currentItem
            ? `Lesson ${currentItem.sequence}: ${currentItem.title}`
            : progress
              ? "Plan completed 🎉"
              : "Not started"}
        </Badge>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={!currentItem} onClick={() => currentItem && onLaunch(currentItem)}>
          ▶ Launch Lesson
        </Button>
        {!progress && (
          <Button size="sm" onClick={handleAssignStart} disabled={busy || items.length === 0}>
            ＋ Assign Lesson 1
          </Button>
        )}
      </div>

      {canManage && progress && (
        <div className="mb-3 grid gap-2.5 sm:grid-cols-[1fr_auto]">
          <Select value={currentItem?.id ?? ""} onChange={(e) => handleChangeLesson(e.target.value)} disabled={busy}>
            <option value="">Change / repeat / skip lesson…</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.sequence}. {i.title}
                {completedItemIds.has(i.id) ? " ✓" : ""}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="gold" onClick={handleMarkCompleted} disabled={busy || !currentItem}>
            ✅ Mark Completed & Advance
          </Button>
        </div>
      )}

      {completedItems.length > 0 && (
        <div className="mb-3">
          <h5 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
            Completed ({completedItems.length}/{items.length})
          </h5>
          <div className="flex flex-wrap gap-1.5">
            {completedItems.map((i) => (
              <Badge key={i.id} tone="green">
                {i.sequence}. {i.title}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {canManage && progress && (
        <div>
          <h5 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Notes</h5>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Progress notes for this student…" />
          <Button size="sm" variant="ghost" onClick={handleSaveNotes} disabled={savingNotes} className="mt-2">
            {savingNotes ? "Saving…" : "Save Notes"}
          </Button>
        </div>
      )}
    </Card>
  );
}
