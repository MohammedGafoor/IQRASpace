"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import type { AppUser, ClassMember, ClassRow, Lesson, LessonProgress } from "@/lib/types";
import { isAdminRole } from "@/lib/roles";
import { Card, Eyebrow, SectionHead } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Badge";
import { ProgressBar, StatCard } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { StudentLessonManager } from "@/components/students/StudentLessonManager";

export default function ProgressPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const isTutor = profile?.role === "tutor";
  // Admin/super_admin see and manage every tutor's students, not just their
  // own — see the classesQuery branch below (0018_admin_full_access.sql).
  const canManage = isTutor || isAdminRole(profile?.role);

  const [students, setStudents] = useState<AppUser[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [entries, setEntries] = useState<LessonProgress[]>([]);
  const [classMembers, setClassMembers] = useState<ClassMember[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;

    if (!canManage) {
      setSelected(profile.id);
      setStudents([profile]);
      setLoading(false);
      return;
    }

    const classesQuery = supabase.from("classes").select("*");
    const { data: classRows } = await (isTutor ? classesQuery.eq("tutor_id", profile.id) : classesQuery);
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
    const members = (memberRows ?? []) as ClassMember[];
    setClassMembers(members);
    const studentIds = Array.from(new Set(members.map((m) => m.student_id)));
    if (studentIds.length === 0) {
      setLoading(false);
      return;
    }
    const { data: userRows } = await supabase.from("users").select("*").in("id", studentIds);
    const rows = (userRows ?? []) as AppUser[];
    setStudents(rows);
    setSelected((prev) => prev || rows[0]?.id || "");
    setLoading(false);
  }, [profile, isTutor, canManage]);

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
  }, [selected]);

  // Scoped to the selected student's own classes — previously this passed
  // every lesson across all of the tutor's classes, letting a tutor log a
  // "skill score" against a session the selected student never attended.
  const selectedStudentClassIds = classMembers.filter((m) => m.student_id === selected).map((m) => m.class_id);
  const studentLessons = lessons.filter((l) => selectedStudentClassIds.includes(l.class_id));

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

      {canManage && students.length > 0 && (
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
          {student && (
            <div>
              <SectionHead
                eyebrow="Curriculum"
                title="Lesson Plan Progress"
                subtitle="Automatically follows this student's assigned class — change, repeat, skip, or confirm a lesson below."
              />
              <StudentLessonManager
                studentId={selected}
                tutorId={profile?.id ?? ""}
                canManage={canManage}
                onChanged={load}
              />
            </div>
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

      {canManage && student && (
        <Card>
          <SectionHead
            title="Skill Score Entry"
            subtitle="Log recitation/tajweed/memorization scores against a conducted session — separate from the student's lesson-plan position above."
          />
          {studentLessons.length === 0 ? (
            <EmptyState icon="🗓️">
              No sessions scheduled yet for {student.full_name}&rsquo;s class — schedule one first, then come back to
              log a skill score against it.
              <br />
              <Link href="/schedule" className="mt-2 inline-block font-semibold text-primary hover:underline">
                Go to Schedule →
              </Link>
            </EmptyState>
          ) : (
            <AddProgressForm
              key={selected}
              studentId={selected}
              lessons={studentLessons}
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
          )}
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
