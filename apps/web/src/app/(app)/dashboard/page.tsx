"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import type { AttendanceRecord, ClassMember, ClassRow, Lesson, LessonNote } from "@/lib/types";
import { formatDate, formatTime, todayISO } from "@/lib/format";
import { Card, Eyebrow, SectionHead } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";

const QUICK_ACTIONS = [
  { href: "/schedule", icon: "📅", label: "Schedule" },
  { href: "/students", icon: "🎓", label: "Students" },
  { href: "/materials", icon: "📄", label: "Materials" },
  { href: "/attendance", icon: "✅", label: "Attendance" },
  { href: "/notes", icon: "📝", label: "Lesson Notes" },
];

export default function DashboardPage() {
  const { profile } = useAuth();
  const isTutor = profile?.role === "tutor";

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [attendancePct, setAttendancePct] = useState<number | null>(null);
  const [recentNotes, setRecentNotes] = useState<LessonNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    let active = true;

    async function load() {
      const [{ data: classRows }, { data: lessonRows }] = await Promise.all([
        supabase.from("classes").select("*"),
        supabase.from("lessons").select("*").order("lesson_date", { ascending: true }),
      ]);
      if (!active) return;
      const classList = classRows ?? [];
      const lessonList = (lessonRows ?? []) as Lesson[];
      setClasses(classList);
      setLessons(lessonList);

      if (isTutor && classList.length > 0) {
        const { data: memberRows } = await supabase
          .from("class_members")
          .select("student_id")
          .in(
            "class_id",
            classList.map((c) => c.id)
          );
        const unique = new Set(((memberRows ?? []) as ClassMember[]).map((m) => m.student_id));
        if (active) setStudentCount(unique.size);
      }

      const lessonIds = lessonList.map((l) => l.id);
      if (lessonIds.length > 0) {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { data: attRows } = await supabase
          .from("attendance")
          .select("*")
          .in("lesson_id", lessonIds)
          .gte("marked_at", weekAgo.toISOString());
        const records = (attRows ?? []) as AttendanceRecord[];
        if (active && records.length > 0) {
          const present = records.filter((r) => r.status === "present" || r.status === "late").length;
          setAttendancePct(Math.round((present / records.length) * 100));
        }

        const { data: noteRows } = await supabase
          .from("lesson_notes")
          .select("*")
          .in("lesson_id", lessonIds)
          .order("created_at", { ascending: false })
          .limit(3);
        if (active) setRecentNotes((noteRows ?? []) as LessonNote[]);
      }

      if (active) setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [profile, isTutor]);

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  const today = todayISO();
  const todaysLessons = lessons.filter((l) => l.lesson_date === today);
  const upcomingLessons = lessons.filter((l) => l.lesson_date > today).slice(0, 5);

  function classNameFor(id: string) {
    return classes.find((c) => c.id === id)?.name ?? "Unknown class";
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Eyebrow>{isTutor ? "Tutor Dashboard" : "Student Dashboard"}</Eyebrow>
        <h1 className="text-2xl font-semibold">
          {isTutor ? "Good to see you" : "Welcome"}, {profile?.full_name ?? ""}
        </h1>
        {!isTutor && <p className="mt-1 text-sm text-muted">Your classes and lessons, read-only.</p>}
      </div>

      {isTutor && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard value={todaysLessons.length} label="Lessons today" />
          <StatCard value={studentCount} label="Active students" />
          <StatCard value={attendancePct !== null ? `${attendancePct}%` : "—"} label="Attendance this week" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHead title="Today's Lessons" />
          {todaysLessons.length === 0 ? (
            <EmptyState icon="🌙">Nothing scheduled for today.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {todaysLessons.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                  <div>
                    <b className="block text-sm">{l.title}</b>
                    <span className="text-xs text-muted">
                      {classNameFor(l.class_id)} · {formatTime(l.start_time) ?? "time TBD"}
                    </span>
                  </div>
                  {isTutor && (
                    <LinkButton href={`/teach/${l.id}`} size="sm">
                      Start
                    </LinkButton>
                  )}
                </li>
              ))}
            </ul>
          )}
          {upcomingLessons.length > 0 && (
            <p className="mt-3 text-xs text-muted">
              Next up: {upcomingLessons[0].title} on {formatDate(upcomingLessons[0].lesson_date)}.
            </p>
          )}
        </Card>

        <Card>
          <SectionHead title="Quick Actions" />
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="rounded-[var(--radius-m)] border border-line bg-paper-alt px-2 py-4 text-center text-[0.8rem] font-bold hover:border-primary hover:text-primary"
              >
                <span className="mb-1.5 block text-xl">{a.icon}</span>
                {a.label}
              </Link>
            ))}
          </div>

          <SectionHead title="Recent Lesson Notes" />
          {recentNotes.length === 0 ? (
            <EmptyState icon="📝">Nothing recorded yet.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {recentNotes.map((n) => (
                <li key={n.id} className="text-ink-soft">
                  📝 {n.covered || n.note || "Lesson note"} —{" "}
                  <span className="text-muted">{new Date(n.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <SectionHead title="My Classes" action={isTutor ? <LinkButton href="/classes" size="sm" variant="outline">Manage</LinkButton> : undefined} />
        {classes.length === 0 ? (
          <EmptyState icon="📚">{isTutor ? "No classes yet — create one to get started." : "You're not in any classes yet."}</EmptyState>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {classes.map((c) => (
              <li key={c.id} className="rounded-full border border-line bg-paper-alt px-3.5 py-1.5 text-sm font-semibold">
                {c.name}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
