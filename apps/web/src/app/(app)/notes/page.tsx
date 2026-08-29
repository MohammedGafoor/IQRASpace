"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import type { Lesson, LessonNote } from "@/lib/types";
import { notifyUser } from "@/lib/notifications";
import { Card, Eyebrow, SectionHead } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

export default function NotesPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const isTutor = profile?.role === "tutor";

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [notes, setNotes] = useState<LessonNote[]>([]);
  const [lessonId, setLessonId] = useState("");
  const [covered, setCovered] = useState("");
  const [performance, setPerformance] = useState("");
  const [nextPlan, setNextPlan] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: lessonRows } = await supabase.from("lessons").select("*").order("lesson_date", { ascending: false });
    const rows = (lessonRows ?? []) as Lesson[];
    setLessons(rows);
    setLessonId((prev) => prev || rows[0]?.id || "");

    const lessonIds = rows.map((l) => l.id);
    if (lessonIds.length > 0) {
      const { data: noteRows } = await supabase
        .from("lesson_notes")
        .select("*")
        .in("lesson_id", lessonIds)
        .order("created_at", { ascending: false })
        .limit(10);
      setNotes((noteRows ?? []) as LessonNote[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  function lessonTitle(id: string) {
    return lessons.find((l) => l.id === id)?.title ?? "Lesson";
  }

  async function handleSave() {
    if (!lessonId) return;
    setSaving(true);
    const { error } = await supabase.from("lesson_notes").insert({
      lesson_id: lessonId,
      covered: covered || null,
      performance_note: performance || null,
      next_lesson_plan: nextPlan || null,
    });
    setSaving(false);
    if (error) {
      showToast(error.message);
      return;
    }

    const lesson = lessons.find((l) => l.id === lessonId);
    if (lesson) {
      const { data: memberRows } = await supabase.from("class_members").select("student_id").eq("class_id", lesson.class_id);
      for (const m of memberRows ?? []) {
        await notifyUser({
          userId: m.student_id,
          type: "lesson_note_added",
          title: "New lesson note",
          body: covered || lesson.title,
          relatedLessonId: lessonId,
        });
      }
    }

    showToast("Lesson note saved");
    setCovered("");
    setPerformance("");
    setNextPlan("");
    load();
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Eyebrow>Lesson Notes</Eyebrow>
        <h1 className="text-2xl font-semibold">A short record after every lesson</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHead title="Recent Notes" />
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : notes.length === 0 ? (
            <EmptyState icon="📝">No notes yet.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {notes.map((n) => (
                <li key={n.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                  <div className="flex justify-between text-sm">
                    <b>{lessonTitle(n.lesson_id)}</b>
                    <span className="text-muted">{new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                  {n.covered && <p className="mt-1 text-sm text-ink-soft">{n.covered}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {isTutor && (
          <Card>
            <SectionHead title="New Lesson Note" />
            <Field label="Lesson">
              <Select value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
                {lessons.length === 0 && <option value="">No lessons yet</option>}
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title} — {l.lesson_date}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="What was covered">
              <Textarea value={covered} onChange={(e) => setCovered(e.target.value)} placeholder="Ayah 1–4, Madd rules…" />
            </Field>
            <Field label="Student performance">
              <Textarea
                value={performance}
                onChange={(e) => setPerformance(e.target.value)}
                placeholder="Good pronunciation, needs practice on…"
              />
            </Field>
            <Field label="Next lesson">
              <Textarea value={nextPlan} onChange={(e) => setNextPlan(e.target.value)} placeholder="Ayah 5–7, review Madd rules" />
            </Field>
            <Button onClick={handleSave} disabled={saving || !lessonId} className="w-full">
              {saving ? "Saving…" : "Save Lesson"}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
