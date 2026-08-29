"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import type { AppUser, AttendanceRecord, AttendanceStatus, ClassMember, Lesson } from "@/lib/types";
import { notifyUser } from "@/lib/notifications";
import { Card, Eyebrow } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

const STATUS_TONE: Record<AttendanceStatus, BadgeTone> = {
  present: "green",
  absent: "red",
  late: "amber",
  excused: "muted",
};
const STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused"];

export default function AttendancePage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const isTutor = profile?.role === "tutor";

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonId, setLessonId] = useState("");
  const [students, setStudents] = useState<AppUser[]>([]);
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [weekPct, setWeekPct] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("lessons")
      .select("*")
      .order("lesson_date", { ascending: false })
      .then(async ({ data }) => {
        const rows = (data ?? []) as Lesson[];
        setLessons(rows);
        const today = new Date().toISOString().slice(0, 10);
        setLessonId((prev) => prev || rows.find((l) => l.lesson_date === today)?.id || rows[0]?.id || "");

        if (isTutor && rows.length > 0) {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          const { data: attRows } = await supabase
            .from("attendance")
            .select("*")
            .in("lesson_id", rows.map((r) => r.id))
            .gte("marked_at", weekAgo.toISOString());
          const all = (attRows ?? []) as AttendanceRecord[];
          if (all.length > 0) {
            const present = all.filter((a) => a.status === "present" || a.status === "late").length;
            setWeekPct(Math.round((present / all.length) * 100));
          }
        }
        setLoading(false);
      });
  }, [profile, isTutor]);

  const loadRoster = useCallback(async (id: string) => {
    if (!id) return;
    const lesson = lessons.find((l) => l.id === id);
    if (!lesson) return;
    const [{ data: memberRows }, { data: attRows }] = await Promise.all([
      supabase.from("class_members").select("*").eq("class_id", lesson.class_id),
      supabase.from("attendance").select("*").eq("lesson_id", id),
    ]);
    const studentIds = ((memberRows ?? []) as ClassMember[]).map((m) => m.student_id);
    const { data: userRows } = studentIds.length
      ? await supabase.from("users").select("*").in("id", studentIds)
      : { data: [] };
    setStudents((userRows ?? []) as AppUser[]);
    const byStudent: Record<string, AttendanceRecord> = {};
    for (const r of (attRows ?? []) as AttendanceRecord[]) byStudent[r.student_id] = r;
    setRecords(byStudent);
  }, [lessons]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (lessonId) loadRoster(lessonId);
  }, [lessonId, loadRoster]);

  async function setStatus(studentId: string, status: AttendanceStatus) {
    const { data, error } = await supabase
      .from("attendance")
      .upsert({ lesson_id: lessonId, student_id: studentId, status }, { onConflict: "lesson_id,student_id" })
      .select()
      .single();
    if (error) {
      showToast(error.message);
      return;
    }
    setRecords((prev) => ({ ...prev, [studentId]: data as AttendanceRecord }));
    showToast("Attendance updated");
    if (status === "absent") {
      await notifyUser({
        userId: studentId,
        type: "attendance_marked",
        title: "Marked absent",
        body: lessons.find((l) => l.id === lessonId)?.title,
        relatedLessonId: lessonId,
      });
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <Eyebrow>Attendance</Eyebrow>
          <h1 className="text-2xl font-semibold">Mark it once, see it everywhere</h1>
        </div>
        {weekPct !== null && <StatCard value={`${weekPct}%`} label="Overall attendance this week" />}
      </div>

      <Card>
        <div className="mb-4 max-w-sm">
          <Select value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
            {lessons.length === 0 && <option value="">No lessons yet</option>}
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title} — {l.lesson_date}
              </option>
            ))}
          </Select>
        </div>

        {students.length === 0 ? (
          <EmptyState icon="✅">No students in this lesson&rsquo;s class yet.</EmptyState>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="pb-2 text-xs font-bold uppercase tracking-wide">Student</th>
                <th className="pb-2 text-xs font-bold uppercase tracking-wide">Status</th>
                {isTutor && <th className="pb-2" />}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const record = records[s.id];
                return (
                  <tr key={s.id} className="border-t border-line">
                    <td className="py-2.5">{s.full_name}</td>
                    <td className="py-2.5">
                      <Badge tone={record ? STATUS_TONE[record.status] : "muted"}>{record?.status ?? "Not marked"}</Badge>
                    </td>
                    {isTutor && (
                      <td className="py-2.5">
                        <div className="flex gap-1.5">
                          {STATUSES.map((st) => (
                            <button
                              key={st}
                              onClick={() => setStatus(s.id, st)}
                              className="rounded-full bg-paper-alt px-2.5 py-1 text-xs font-semibold text-ink-soft hover:text-ink"
                            >
                              {st[0].toUpperCase() + st.slice(1)}
                            </button>
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
