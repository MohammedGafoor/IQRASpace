"use client";

import { useEffect, useState } from "react";
import { notifyUser } from "@/lib/notifications";
import { confirmStudentLessonCompleted } from "@/lib/curriculum";
import type { AppUser, LessonPlanItem } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

/**
 * Per-student checklist for confirming a session's Universal Lesson Plan item
 * complete. Ending a session never advances a student on its own — only this
 * explicit tutor action does, and only for whichever students are checked.
 */
export function ConfirmLessonCompletion({
  lessonId,
  planItem,
  tutorId,
  participants,
  onConfirmed,
  onCancel,
}: {
  lessonId: string;
  planItem: LessonPlanItem;
  tutorId: string;
  participants: AppUser[];
  onConfirmed: () => void;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecked(Object.fromEntries(participants.map((p) => [p.id, true])));
  }, [participants]);

  const selectedCount = Object.values(checked).filter(Boolean).length;

  async function handleConfirm() {
    setSaving(true);
    const selected = participants.filter((p) => checked[p.id]);

    for (const student of selected) {
      const { nextItem } = await confirmStudentLessonCompleted(student.id, tutorId, planItem, {
        lessonId,
        notes: notes[student.id] || null,
      });

      await notifyUser({
        userId: student.id,
        type: "lesson_plan_advanced",
        title: nextItem ? "Lesson completed — moving on" : "Curriculum completed! 🎉",
        body: nextItem
          ? `"${planItem.title}" confirmed complete. Next up: ${nextItem.title}.`
          : `"${planItem.title}" confirmed complete — you've finished this curriculum!`,
        relatedLessonId: lessonId,
      });
    }

    setSaving(false);
    onConfirmed();
  }

  return (
    <div className="grid gap-3.5">
      <div>
        <h3 className="text-base font-semibold">Confirm Lesson Completed</h3>
        <p className="mt-1 text-sm text-ink-soft">
          {planItem.title} — only checked students advance to the next lesson. Ending this session never advances
          anyone on its own.
        </p>
      </div>

      {participants.length === 0 ? (
        <p className="text-sm text-muted">No students enrolled in this class.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {participants.map((p) => (
            <div key={p.id} className="rounded-[var(--radius-m)] border border-line p-3">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={checked[p.id] ?? false}
                  onChange={(e) => setChecked((prev) => ({ ...prev, [p.id]: e.target.checked }))}
                />
                {p.full_name}
              </label>
              {checked[p.id] && (
                <Input
                  placeholder="Optional note for this student…"
                  className="mt-2"
                  value={notes[p.id] ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [p.id]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2.5">
        <Button onClick={handleConfirm} disabled={saving || selectedCount === 0} className="flex-1">
          {saving ? "Confirming…" : `Confirm for ${selectedCount} Student${selectedCount === 1 ? "" : "s"}`}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
