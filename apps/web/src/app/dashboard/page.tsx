"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import type { ClassRow, Lesson } from "@/lib/types";

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function DashboardContent() {
  const { profile } = useAuth();
  const isTutor = profile?.role === "tutor";

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: classRows }, { data: lessonRows }] = await Promise.all([
        supabase.from("classes").select("*"),
        supabase.from("lessons").select("*").order("lesson_date", { ascending: true }),
      ]);
      setClasses(classRows ?? []);
      setLessons(lessonRows ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p className="p-8 text-sm text-neutral-500">Loading…</p>;

  const today = todayISO();
  const todaysLessons = lessons.filter((l) => l.lesson_date === today);
  const upcomingLessons = lessons.filter((l) => l.lesson_date > today).slice(0, 5);
  const recentLessons = lessons
    .filter((l) => l.lesson_date < today)
    .slice(-5)
    .reverse();

  function classNameFor(id: string) {
    return classes.find((c) => c.id === id)?.name ?? "Unknown class";
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl font-semibold">
        {isTutor ? "Dashboard" : `Welcome, ${profile?.full_name ?? ""}`}
      </h1>

      {!isTutor && (
        <p className="mt-2 text-sm text-neutral-500">
          Your classes and lessons — read-only. Live lesson sharing arrives in a
          later phase.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card title="Today's lessons">
          {todaysLessons.length === 0 ? (
            <Empty>Nothing scheduled today.</Empty>
          ) : (
            <LessonList lessons={todaysLessons} classNameFor={classNameFor} />
          )}
        </Card>

        <Card title="Upcoming lessons">
          {upcomingLessons.length === 0 ? (
            <Empty>Nothing upcoming yet.</Empty>
          ) : (
            <LessonList lessons={upcomingLessons} classNameFor={classNameFor} />
          )}
        </Card>

        <Card title="My classes" action={isTutor ? { href: "/classes", label: "Manage" } : undefined}>
          {classes.length === 0 ? (
            <Empty>{isTutor ? "No classes yet." : "You're not in any classes yet."}</Empty>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {classes.map((c) => (
                <li key={c.id}>{c.name}</li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent lessons" action={isTutor ? { href: "/lessons", label: "View all" } : undefined}>
          {recentLessons.length === 0 ? (
            <Empty>No past lessons yet.</Empty>
          ) : (
            <LessonList lessons={recentLessons} classNameFor={classNameFor} />
          )}
        </Card>
      </div>

      {isTutor && (
        <p className="mt-6 text-xs text-neutral-400">
          Active Lesson, Recently Used PDFs and Attendance Snapshot cards arrive
          with the PDF pipeline / Highlighting+Realtime / Meet+Attendance phases.
        </p>
      )}
    </main>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className="rounded border border-black/[.08] p-4 dark:border-white/[.145]">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-500">{title}</h2>
        {action && (
          <Link href={action.href} className="text-xs underline">
            {action.label}
          </Link>
        )}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-neutral-400">{children}</p>;
}

function LessonList({
  lessons,
  classNameFor,
}: {
  lessons: Lesson[];
  classNameFor: (id: string) => string;
}) {
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {lessons.map((l) => (
        <li key={l.id} className="flex justify-between gap-2">
          <span>{l.title}</span>
          <span className="text-neutral-400">
            {classNameFor(l.class_id)} · {l.lesson_date}
          </span>
        </li>
      ))}
    </ul>
  );
}
