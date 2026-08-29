"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import type { AppUser, AttendanceRecord, ClassMember, ClassRow, Lesson, LessonNote, LessonProgress } from "@/lib/types";
import { getStudentCurriculumProgress, type CurriculumRow } from "@/lib/curriculum";
import { formatDate, todayISO } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar, StatCard } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";

type StudentRow = {
  user: AppUser;
  classNames: string[];
  nextLesson: Lesson | null;
};

export default function StudentsPage() {
  const { profile } = useAuth();
  const isTutor = profile?.role === "tutor";

  const [rows, setRows] = useState<StudentRow[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openStudent, setOpenStudent] = useState<AppUser | null>(null);

  useEffect(() => {
    if (!profile || !isTutor) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    let active = true;

    async function load() {
      const { data: classRows } = await supabase.from("classes").select("*").eq("tutor_id", profile!.id);
      const classes = (classRows ?? []) as ClassRow[];
      if (classes.length === 0) {
        if (active) {
          setRows([]);
          setLoading(false);
        }
        return;
      }

      const classIds = classes.map((c) => c.id);
      const [{ data: memberRows }, { data: lessonRows }] = await Promise.all([
        supabase.from("class_members").select("*").in("class_id", classIds),
        supabase.from("lessons").select("*").in("class_id", classIds).order("lesson_date", { ascending: true }),
      ]);
      const members = (memberRows ?? []) as ClassMember[];
      const lessonList = (lessonRows ?? []) as Lesson[];
      if (active) setLessons(lessonList);

      const studentIds = Array.from(new Set(members.map((m) => m.student_id)));
      if (studentIds.length === 0) {
        if (active) {
          setRows([]);
          setLoading(false);
        }
        return;
      }

      const { data: userRows } = await supabase.from("users").select("*").in("id", studentIds);
      const users = (userRows ?? []) as AppUser[];
      const today = todayISO();

      const built: StudentRow[] = users.map((u) => {
        const studentClassIds = members.filter((m) => m.student_id === u.id).map((m) => m.class_id);
        const classNames = classes.filter((c) => studentClassIds.includes(c.id)).map((c) => c.name);
        const upcoming = lessonList
          .filter((l) => studentClassIds.includes(l.class_id) && l.lesson_date >= today)
          .sort((a, b) => a.lesson_date.localeCompare(b.lesson_date));
        return { user: u, classNames, nextLesson: upcoming[0] ?? null };
      });

      if (active) {
        setRows(built.sort((a, b) => a.user.full_name.localeCompare(b.user.full_name)));
        setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [profile, isTutor]);

  if (!isTutor) {
    return (
      <Card>
        <EmptyState icon="🎓">A student directory is available to tutors. Check Progress for your own record.</EmptyState>
      </Card>
    );
  }

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  const filtered = rows.filter((r) => r.user.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search students…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-[260px]"
        />
        <span className="text-sm text-muted">
          {filtered.length} student{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon="🎓">No students yet — add one from a class in Classes.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <Card key={r.user.id} className="cursor-pointer hover:shadow-[var(--shadow-m)]" onClick={() => setOpenStudent(r.user)}>
              <div className="mb-3 flex items-center gap-3">
                <Avatar name={r.user.full_name} size={44} />
                <div>
                  <b className="block text-[0.94rem]">{r.user.full_name}</b>
                  <span className="text-[0.76rem] text-muted">{r.classNames.join(", ") || "No class yet"}</span>
                </div>
              </div>
              <div className="flex justify-between text-[0.76rem] text-muted">
                <span>Next lesson</span>
                <span className="text-ink">{r.nextLesson ? `${formatDate(r.nextLesson.lesson_date)}` : "—"}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!openStudent} onClose={() => setOpenStudent(null)}>
        {openStudent && <StudentProfile student={openStudent} lessons={lessons} />}
      </Modal>
    </div>
  );
}

function StudentProfile({ student, lessons }: { student: AppUser; lessons: Lesson[] }) {
  const [progress, setProgress] = useState<LessonProgress[]>([]);
  const [notes, setNotes] = useState<LessonNote[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [curriculum, setCurriculum] = useState<CurriculumRow[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      const lessonIds = lessons.map((l) => l.id);
      const [{ data: progressRows }, { data: attRows }] = await Promise.all([
        supabase
          .from("lesson_progress")
          .select("*")
          .eq("student_id", student.id)
          .order("created_at", { ascending: false }),
        supabase.from("attendance").select("*").eq("student_id", student.id),
      ]);
      if (!active) return;
      setProgress((progressRows ?? []) as LessonProgress[]);
      setAttendance((attRows ?? []) as AttendanceRecord[]);

      if (lessonIds.length > 0) {
        const { data: noteRows } = await supabase
          .from("lesson_notes")
          .select("*")
          .in("lesson_id", lessonIds)
          .order("created_at", { ascending: false })
          .limit(5);
        if (active) setNotes((noteRows ?? []) as LessonNote[]);
      }

      const rows = await getStudentCurriculumProgress(student.id);
      if (active) setCurriculum(rows);
    }
    load();
    return () => {
      active = false;
    };
  }, [student.id, lessons]);

  const latest = progress[0];
  const attendancePct =
    attendance.length > 0
      ? Math.round((attendance.filter((a) => a.status === "present" || a.status === "late").length / attendance.length) * 100)
      : null;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Avatar name={student.full_name} size={56} />
        <div>
          <b className="text-lg font-semibold">{student.full_name}</b>
          <p className="text-sm text-muted">{student.email}</p>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard value={progress.length} label="Progress entries" />
        <StatCard value={attendancePct !== null ? `${attendancePct}%` : "—"} label="Attendance" />
      </div>
      {curriculum.length > 0 && (
        <>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Curriculum Progress</h4>
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
        </>
      )}
      {latest && (
        <>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Latest Skill Scores</h4>
          {latest.recitation_score !== null && <ProgressBar label="Recitation" value={latest.recitation_score} />}
          {latest.tajweed_score !== null && <ProgressBar label="Tajweed" value={latest.tajweed_score} />}
          {latest.memorization_score !== null && <ProgressBar label="Memorization" value={latest.memorization_score} />}
        </>
      )}
      <h4 className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-muted">Recent Lesson Notes</h4>
      {notes.length === 0 ? (
        <p className="text-sm text-muted">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-sm text-ink-soft">
          {notes.map((n) => (
            <li key={n.id}>{n.covered || n.note || "Lesson note"}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
