"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import type { ClassRow, Lesson } from "@/lib/types";
import { formatTime } from "@/lib/format";
import { Card, Eyebrow } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CreateLessonForm } from "@/components/lessons/CreateLessonForm";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weekDates(): string[] {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export default function SchedulePage() {
  const { profile } = useAuth();
  const isTutor = profile?.role === "tutor";

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalDate, setModalDate] = useState<string | null>(null);

  const dates = weekDates();

  const load = useCallback(async () => {
    const [{ data: lessonRows }, { data: classRows }] = await Promise.all([
      supabase.from("lessons").select("*").gte("lesson_date", dates[0]).lte("lesson_date", dates[6]),
      supabase.from("classes").select("*"),
    ]);
    setLessons((lessonRows ?? []) as Lesson[]);
    setClasses(classRows ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function classNameFor(id: string) {
    return classes.find((c) => c.id === id)?.name ?? "";
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Eyebrow>This week</Eyebrow>
          <h1 className="text-2xl font-semibold">Schedule</h1>
        </div>
        {isTutor && <Button onClick={() => setModalDate(dates[0])}>+ Create Lesson</Button>}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <Card>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
            {dates.map((date, i) => {
              const dayLessons = lessons
                .filter((l) => l.lesson_date === date)
                .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
              const isToday = date === new Date().toISOString().slice(0, 10);
              return (
                <div key={date} className={`min-h-[180px] rounded-[var(--radius-m)] p-2.5 ${isToday ? "bg-primary-tint" : "bg-paper-alt"}`}>
                  <b className="mb-2 block text-[0.78rem] text-ink-soft">
                    {DAY_LABELS[i]} <span className="text-muted">{date.slice(5)}</span>
                  </b>
                  {dayLessons.map((l) => (
                    <Link
                      key={l.id}
                      href={`/teach/${l.id}`}
                      className="mb-1.5 block rounded-[8px] border border-l-[3px] border-line border-l-primary bg-surface p-2 text-[0.7rem]"
                    >
                      <b className="block text-[0.72rem]">{formatTime(l.start_time) ?? "—"}</b>
                      <span className="text-ink-soft">
                        {l.title} · {classNameFor(l.class_id)}
                      </span>
                    </Link>
                  ))}
                  {isTutor && (
                    <button
                      onClick={() => setModalDate(date)}
                      className="w-full rounded-[8px] border border-dashed border-line py-1.5 text-center text-[0.68rem] text-muted hover:border-primary hover:text-primary"
                    >
                      + Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Modal open={!!modalDate} onClose={() => setModalDate(null)}>
        <h3 className="mb-3 text-base font-semibold">Create Lesson</h3>
        <CreateLessonForm
          defaultDate={modalDate ?? undefined}
          onCreated={() => {
            setModalDate(null);
            load();
          }}
        />
      </Modal>
    </div>
  );
}
