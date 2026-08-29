"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Lesson, Meeting } from "@/lib/types";
import { formatDate, formatTime, todayISO } from "@/lib/format";
import { Card, Eyebrow, SectionHead } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

type Row = { lesson: Lesson; meeting: Meeting };

export default function MeetPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const today = todayISO();
      const { data: lessonRows } = await supabase
        .from("lessons")
        .select("*")
        .gte("lesson_date", today)
        .order("lesson_date", { ascending: true });
      const lessons = (lessonRows ?? []) as Lesson[];
      if (lessons.length === 0) {
        setLoading(false);
        return;
      }
      const { data: meetingRows } = await supabase
        .from("meetings")
        .select("*")
        .in("lesson_id", lessons.map((l) => l.id));
      const meetings = (meetingRows ?? []) as Meeting[];
      const built = lessons
        .map((lesson) => {
          const meeting = meetings.find((m) => m.lesson_id === lesson.id);
          return meeting ? { lesson, meeting } : null;
        })
        .filter((r): r is Row => r !== null);
      setRows(built);
      setLoading(false);
    }
    load();
  }, []);

  function copyLink(url: string) {
    navigator.clipboard?.writeText(url);
    showToast("Meeting link copied to clipboard");
  }

  const today = todayISO();
  const todayRow = rows.find((r) => r.lesson.lesson_date === today);
  const upcoming = rows.filter((r) => r.lesson.lesson_date !== today);

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-5">
      {todayRow ? (
        <Card>
          <Eyebrow>Today&rsquo;s Online Lesson</Eyebrow>
          <h3 className="text-lg font-semibold">{todayRow.lesson.title}</h3>
          <p className="mt-1 text-sm text-ink-soft">
            {formatDate(todayRow.lesson.lesson_date)}
            {todayRow.lesson.start_time && ` · ${formatTime(todayRow.lesson.start_time)}`}
          </p>
          <div className="mt-3.5 flex flex-wrap gap-2.5">
            <a href={todayRow.meeting.meet_url} target="_blank" rel="noreferrer">
              <Button>🎥 Join Google Meet</Button>
            </a>
            <Button variant="outline" onClick={() => copyLink(todayRow.meeting.meet_url)}>
              🔗 Copy Meeting Link
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <EmptyState icon="🎥">No Meet link for today — add one when creating a lesson.</EmptyState>
        </Card>
      )}

      <Card>
        <SectionHead title="Upcoming Lessons with Meet Links" />
        {upcoming.length === 0 ? (
          <EmptyState icon="📅">Nothing else scheduled with a Meet link yet.</EmptyState>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="pb-2 text-xs font-bold uppercase tracking-wide">Lesson</th>
                <th className="pb-2 text-xs font-bold uppercase tracking-wide">When</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {upcoming.map((r) => (
                <tr key={r.lesson.id} className="border-t border-line">
                  <td className="py-2.5">{r.lesson.title}</td>
                  <td className="py-2.5 text-ink-soft">
                    {formatDate(r.lesson.lesson_date)}
                    {r.lesson.start_time && ` · ${formatTime(r.lesson.start_time)}`}
                  </td>
                  <td className="py-2.5 text-right">
                    <a href={r.meeting.meet_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary hover:underline">
                      Join
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="bg-primary-tint">
        <p className="m-0 text-sm text-primary-deep">
          The Google Meet link lives with the lesson, so everything you need to teach — material, meeting and notes —
          is in one place. Add or manage Meet links from <Link href="/lessons" className="underline">Lessons</Link>.
        </p>
      </Card>
    </div>
  );
}
