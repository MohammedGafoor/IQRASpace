"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import type { AppUser, ClassMember, ClassRow, Lesson, LessonProgress } from "@/lib/types";
import { getStudentCurriculumProgress, type CurriculumRow } from "@/lib/curriculum";
import { Card, Eyebrow, SectionHead } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Badge";
import { ProgressBar, StatCard } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

export default function ProgressPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const isTutor = profile?.role === "tutor";

  const [students, setStudents] = useState<AppUser[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [entries, setEntries] = useState<LessonProgress[]>([]);
  const [curriculum, setCurriculum] = useState<CurriculumRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;

    if (!isTutor) {
      setSelected(profile.id);
      setStudents([profile]);
      setLoading(false);
      return;
    }

    const { data: classRows } = await supabase.from("classes").select("*").eq("tutor_id", profile.id);
    const classes = (classRows ?? []) as ClassRow[];
    if (classes.length === 0) {
      setLoading(false);
      return;
    }
    const classIds = classes.map((c) => c.id);
    const [{ data: memberRows }, { data: lessonRows }] = await Promise.all([
      supabase.from("class_members").select("*").in("class_id", classIds),
      supabase.from("lessons").select("*").in("class_id", classIds),
    ]);
    setLessons((lessonRows ?? []) as Lesson[]);
    const studentIds = Array.from(new Set(((memberRows ?? []) as ClassMember[]).map((m) => m.student_id)));
    if (studentIds.length === 0) {
      setLoading(false);
      return;
    }
    const { data: userRows } = await supabase.from("users").select("*").in("id", studentIds);
    const rows = (userRows ?? []) as AppUser[];
    setStudents(rows);
    setSelected((prev) => prev || rows[0]?.id || "");
    setLoading(false);
  }, [profile, isTutor]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    supabase
      .from("lesson_progress")
      .select("*")
      .eq("student_id", selected)
      .order("created_at", { ascending: false })
      .then(({ data }) => setEntries((data ?? []) as LessonProgress[]));
    getStudentCurriculumProgress(selected).then(setCurriculum);
  }, [selected]);

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  const latest = entries[0];
  const student = students.find((s) => s.id === selected);
  const scores = latest
    ? ([
        ["Recitation", latest.recitation_score],
        ["Tajweed", latest.tajweed_score],
        ["Memorization", latest.memorization_score],
      ] as const)
    : [];
  const lowest = scores.filter(([, v]) => v !== null).sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0))[0];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Eyebrow>Student Progress</Eyebrow>
        <h1 className="text-2xl font-semibold">What each student has learned</h1>
      </div>

      {isTutor && students.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {students.map((s) => (
            <Chip key={s.id} active={s.id === selected} onClick={() => setSelected(s.id)}>
              {s.full_name}
            </Chip>
          ))}
        </div>
      )}

      {students.length === 0 ? (
        <Card>
          <EmptyState icon="📈">No students yet.</EmptyState>
        </Card>
      ) : (
        <>
          {curriculum.length > 0 && (
            <Card>
              <SectionHead eyebrow="Curriculum" title="Lesson Plan Progress" />
              {curriculum.map((c) => (
                <div key={c.planId} className="mb-3">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold">{c.planName}</span>
                    <span className="text-xs text-ink-soft">
                      {c.currentTitle ? `Lesson ${c.currentSequence}: ${c.currentTitle}` : "Plan completed 🎉"}
                    </span>
                  </div>
                  <ProgressBar
                    value={c.totalActive > 0 ? Math.round((c.completedCount / c.totalActive) * 100) : 0}
                    label={`${c.completedCount}/${c.totalActive} lessons completed`}
                  />
                </div>
              ))}
            </Card>
          )}
          <Card>
          <Eyebrow>{student?.full_name}</Eyebrow>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard value={entries.length} label="Progress entries" />
            {lowest && <StatCard value={lowest[0]} label="Area to improve" />}
            <StatCard value={latest?.surah_ayah_range ?? "—"} label="Next target" />
          </div>

          {latest ? (
            <>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Current Focus</h4>
              {scores.map(
                ([label, value]) => value !== null && <ProgressBar key={label} label={label} value={value} />
              )}
              {latest.progress_note && (
                <>
                  <h4 className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-muted">Teacher Comments</h4>
                  <p className="text-sm text-ink-soft">{latest.progress_note}</p>
                </>
              )}
            </>
          ) : (
            <EmptyState icon="📈">No progress recorded yet.</EmptyState>
          )}
          </Card>
        </>
      )}

      {isTutor && student && (
        <Card>
          <SectionHead title="Add Progress Entry" subtitle="Record after a lesson to build this student's trend." />
          <AddProgressForm
            studentId={selected}
            lessons={lessons}
            onSaved={() => {
              showToast("Progress saved");
              load();
              supabase
                .from("lesson_progress")
                .select("*")
                .eq("student_id", selected)
                .order("created_at", { ascending: false })
                .then(({ data }) => setEntries((data ?? []) as LessonProgress[]));
            }}
          />
        </Card>
      )}
    </div>
  );
}

function AddProgressForm({
  studentId,
  lessons,
  onSaved,
}: {
  studentId: string;
  lessons: Lesson[];
  onSaved: () => void;
}) {
  const [lessonId, setLessonId] = useState(lessons[0]?.id ?? "");
  const [recitation, setRecitation] = useState(70);
  const [tajweed, setTajweed] = useState(70);
  const [memorization, setMemorization] = useState(70);
  const [note, setNote] = useState("");
  const [range, setRange] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!lessonId) return;
    setSaving(true);
    const { error } = await supabase.from("lesson_progress").insert({
      lesson_id: lessonId,
      student_id: studentId,
      recitation_score: recitation,
      tajweed_score: tajweed,
      memorization_score: memorization,
      progress_note: note || null,
      surah_ayah_range: range || null,
    });
    setSaving(false);
    if (!error) onSaved();
  }

  return (
    <div className="grid gap-3.5 sm:grid-cols-2">
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
      <Field label="Next target (e.g. Ayah 5–7)">
        <Input value={range} onChange={(e) => setRange(e.target.value)} />
      </Field>
      <Field label={`Recitation — ${recitation}%`}>
        <input type="range" min={0} max={100} value={recitation} onChange={(e) => setRecitation(Number(e.target.value))} className="w-full" />
      </Field>
      <Field label={`Tajweed — ${tajweed}%`}>
        <input type="range" min={0} max={100} value={tajweed} onChange={(e) => setTajweed(Number(e.target.value))} className="w-full" />
      </Field>
      <Field label={`Memorization — ${memorization}%`}>
        <input type="range" min={0} max={100} value={memorization} onChange={(e) => setMemorization(Number(e.target.value))} className="w-full" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Teacher comment">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Good pronunciation, needs practice on…" />
        </Field>
      </div>
      <Button onClick={handleSave} disabled={saving || !lessonId} className="sm:col-span-2">
        {saving ? "Saving…" : "Save Progress"}
      </Button>
    </div>
  );
}
