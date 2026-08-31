"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import { getManagedStudentRoster, type ManagedStudent } from "@/lib/roster";
import { getStudentClassCurriculum } from "@/lib/curriculum";
import { generateSessionsForRule } from "@/lib/recurringSessions";
import { notifyUser } from "@/lib/notifications";
import { computeEndTime, formatTime } from "@/lib/format";
import type { RecurringSessionRule } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Schedules a one-to-one Student <-> Tutor session (or a recurring rule that
 * generates several). Student is the primary thing being scheduled — the
 * lesson is only ever shown as a read-only reference to the student's actual
 * current position in their class's Universal Lesson Plan
 * (getStudentClassCurriculum), never chosen here.
 */
export function ScheduleSessionForm({
  onCreated,
  defaultDate,
}: {
  onCreated: () => void;
  defaultDate?: string;
}) {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [roster, setRoster] = useState<ManagedStudent[]>([]);
  const [studentId, setStudentId] = useState("");
  const [classId, setClassId] = useState("");
  const [currentLessonLabel, setCurrentLessonLabel] = useState<string | null>(null);

  const [mode, setMode] = useState<"once" | "recurring">("once");
  const [title, setTitle] = useState("");
  const [lessonDate, setLessonDate] = useState(defaultDate ?? "");
  const [startTime, setStartTime] = useState("16:00");
  const [duration, setDuration] = useState(20);
  const [meetUrl, setMeetUrl] = useState("");
  const [notes, setNotes] = useState("");

  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [startsOn, setStartsOn] = useState(defaultDate ?? new Date().toISOString().slice(0, 10));
  const [endsOn, setEndsOn] = useState("");

  const [creating, setCreating] = useState(false);

  // Roster + this tutor's own default session duration.
  useEffect(() => {
    if (!profile) return;
    getManagedStudentRoster(profile).then((rows) => {
      setRoster(rows);
      if (rows.length > 0) {
        setStudentId((prev) => prev || rows[0].user.id);
        setClassId((prev) => prev || rows[0].classRow.id);
      }
    });
    if (profile.role === "tutor") {
      supabase
        .from("tutors")
        .select("default_lesson_duration_minutes")
        .eq("id", profile.id)
        .single()
        .then(({ data }) => {
          if (data?.default_lesson_duration_minutes) setDuration(data.default_lesson_duration_minutes);
        });
    }
  }, [profile]);

  // A student can be enrolled in more than one class — default to their
  // first, but let the tutor pick if there's more than one. Computed during
  // render rather than synced via effect: `classId` only needs to hold a
  // *user's* explicit pick, and falls back to the student's first class
  // whenever that pick doesn't apply to the currently selected student.
  const studentClasses = roster.filter((r) => r.user.id === studentId).map((r) => r.classRow);
  const effectiveClassId = studentClasses.some((c) => c.id === classId) ? classId : (studentClasses[0]?.id ?? "");

  // Read-only "Current Lesson" reference — never editable here.
  useEffect(() => {
    if (!studentId || !effectiveClassId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentLessonLabel(null);
      return;
    }
    let active = true;
    getStudentClassCurriculum(studentId).then((rows) => {
      if (!active) return;
      const row = rows.find((r) => r.classRow.id === effectiveClassId);
      if (!row?.plan) {
        setCurrentLessonLabel("No curriculum assigned to this class yet");
        return;
      }
      const current = row.items.find((i) => i.id === row.progress?.current_item_id);
      setCurrentLessonLabel(current ? `Lesson ${current.sequence} — ${current.title}` : "Plan completed 🎉");
    });
    return () => {
      active = false;
    };
  }, [studentId, effectiveClassId]);

  const selectedRow = roster.find((r) => r.user.id === studentId && r.classRow.id === effectiveClassId);
  const endTime = computeEndTime(startTime, duration);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile || !studentId || !effectiveClassId || !selectedRow) return;
    setCreating(true);

    // Derive tutor_id from the class, not the caller — matters for
    // admin/super_admin (no `tutors` row, so `tutor_id: profile.id` would
    // violate lessons' FK) and is strictly more correct for a tutor too.
    const tutorId = selectedRow.classRow.tutor_id;
    const sessionTitle = title.trim() || "Session";

    if (mode === "recurring") {
      if (daysOfWeek.length === 0) {
        setCreating(false);
        showToast("Pick at least one day");
        return;
      }
      const { data: rule, error } = await supabase
        .from("recurring_session_rules")
        .insert({
          tutor_id: tutorId,
          student_id: studentId,
          class_id: effectiveClassId,
          days_of_week: daysOfWeek,
          start_time: startTime,
          duration_minutes: duration,
          starts_on: startsOn,
          ends_on: endsOn || null,
        })
        .select()
        .single();

      if (error || !rule) {
        setCreating(false);
        showToast(error?.message ?? "Could not create recurring session");
        return;
      }

      const { created, error: genError } = await generateSessionsForRule(rule as RecurringSessionRule);
      setCreating(false);
      if (genError) {
        showToast(genError.message);
        return;
      }
      showToast(`Recurring session saved — ${created} session${created === 1 ? "" : "s"} scheduled`);
      onCreated();
      return;
    }

    const { data: lesson, error } = await supabase
      .from("lessons")
      .insert({
        student_id: studentId,
        class_id: effectiveClassId,
        tutor_id: tutorId,
        title: sessionTitle,
        lesson_date: lessonDate,
        start_time: startTime || null,
        duration_minutes: duration,
      })
      .select()
      .single();

    if (error || !lesson) {
      setCreating(false);
      showToast(error?.message ?? "Could not schedule session");
      return;
    }

    if (meetUrl.trim()) {
      await supabase.from("meetings").insert({
        lesson_id: lesson.id,
        meet_url: meetUrl.trim(),
        scheduled_start: startTime ? `${lessonDate}T${startTime}:00` : null,
      });
    }
    if (notes.trim()) {
      await supabase.from("lesson_notes").insert({ lesson_id: lesson.id, note: notes.trim() });
    }

    await notifyUser({
      userId: studentId,
      type: "lesson_scheduled",
      title: "New session scheduled",
      body: `${sessionTitle} · ${lessonDate}${startTime ? ` at ${formatTime(startTime)}` : ""}`,
      relatedLessonId: lesson.id,
    });

    setCreating(false);
    showToast("Session scheduled");
    setTitle("");
    setMeetUrl("");
    setNotes("");
    onCreated();
  }

  function toggleDay(day: number) {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3.5 sm:grid-cols-2">
      <Field label="Student">
        <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
          {roster.length === 0 && <option value="">No students yet</option>}
          {Array.from(new Map(roster.map((r) => [r.user.id, r.user])).values()).map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </Select>
      </Field>

      {studentClasses.length > 1 && (
        <Field label="Class">
          <Select value={effectiveClassId} onChange={(e) => setClassId(e.target.value)}>
            {studentClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Current Lesson" hint="Reference only — the schedule never sets this, it just follows the student's progress.">
        <div className="flex h-[38px] items-center text-sm text-ink-soft">{currentLessonLabel ?? "—"}</div>
      </Field>

      <Field label="Session title (optional)">
        <Input placeholder="Session" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <Field label="Schedule type">
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={mode === "once" ? "primary" : "outline"} onClick={() => setMode("once")}>
            One-time
          </Button>
          <Button type="button" size="sm" variant={mode === "recurring" ? "primary" : "outline"} onClick={() => setMode("recurring")}>
            Recurring
          </Button>
        </div>
      </Field>

      {mode === "once" ? (
        <Field label="Date">
          <Input required type="date" value={lessonDate} onChange={(e) => setLessonDate(e.target.value)} />
        </Field>
      ) : (
        <Field label="Starts on">
          <Input required type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
        </Field>
      )}

      <Field label="Start time">
        <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
      </Field>

      <Field label="Duration" hint={endTime ? `Ends at ${endTime}` : undefined}>
        <Select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
          <option value={15}>15 minutes</option>
          <option value={20}>20 minutes</option>
          <option value={30}>30 minutes</option>
          <option value={45}>45 minutes</option>
          <option value={60}>60 minutes</option>
        </Select>
      </Field>

      {mode === "recurring" ? (
        <>
          <Field label="Days">
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((label, day) => (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    daysOfWeek.includes(day)
                      ? "border-primary bg-primary text-white"
                      : "border-line bg-paper-alt text-ink-soft hover:border-primary hover:text-primary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Ends on (optional)" hint="Leave blank to keep generating indefinitely — use “Generate more” later.">
            <Input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
          </Field>
        </>
      ) : (
        <div className="sm:col-span-2">
          <Field label="Notes (optional)">
            <Input placeholder="Anything to remember about this session…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      )}

      <div className="sm:col-span-2">
        <Field label="Google Meet link (optional)" hint="Paste a meet.google.com link — no OAuth needed.">
          <Input type="url" placeholder="https://meet.google.com/abc-defg-hij" value={meetUrl} onChange={(e) => setMeetUrl(e.target.value)} />
        </Field>
      </div>

      <Button type="submit" disabled={creating || roster.length === 0} className="sm:col-span-2">
        {creating ? "Saving…" : mode === "recurring" ? "Save Recurring Session" : "Schedule Session"}
      </Button>
    </form>
  );
}
