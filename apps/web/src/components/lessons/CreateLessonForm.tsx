"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import type { ClassMember, ClassRow, LessonPlanItem } from "@/lib/types";
import { QURAN_SURAHS } from "@/lib/quranContent";
import { notifyUser } from "@/lib/notifications";
import { formatTime } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

/** Class/Session booking form, used inside /schedule's create modal. Books
 * *when* a tutor meets a class — not the curriculum itself (that's the Lesson
 * Library) — so the content picker below sources from whichever Universal
 * Lesson Plan the chosen class is assigned to, rather than a raw surah list. */
export function CreateLessonForm({
  onCreated,
  defaultDate,
}: {
  onCreated: () => void;
  defaultDate?: string;
}) {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [lessonDate, setLessonDate] = useState(defaultDate ?? "");
  const [startTime, setStartTime] = useState("16:00");
  const [duration, setDuration] = useState(45);
  const [surahKey, setSurahKey] = useState(""); // fallback when the class has no assigned plan
  const [planItems, setPlanItems] = useState<LessonPlanItem[]>([]);
  const [lessonPlanItemId, setLessonPlanItemId] = useState("");
  const [meetUrl, setMeetUrl] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase
      .from("classes")
      .select("*")
      .order("name")
      .then(({ data }) => {
        setClasses(data ?? []);
        if (data && data.length > 0) setClassId((prev) => prev || data[0].id);
      });
  }, []);

  useEffect(() => {
    if (!classId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlanItems([]);
      setLessonPlanItemId("");
      return;
    }
    let active = true;

    async function loadPlanForClass() {
      const { data: assignRow } = await supabase
        .from("class_lesson_plans")
        .select("lesson_plan_id")
        .eq("class_id", classId)
        .maybeSingle();

      if (!assignRow) {
        if (active) {
          setPlanItems([]);
          setLessonPlanItemId("");
        }
        return;
      }

      const { data: itemRows } = await supabase
        .from("lesson_plan_items")
        .select("*")
        .eq("lesson_plan_id", assignRow.lesson_plan_id)
        .eq("active", true)
        .order("sequence");
      const items = (itemRows ?? []) as LessonPlanItem[];
      if (!active) return;
      setPlanItems(items);
      if (items.length === 0) {
        setLessonPlanItemId("");
        return;
      }

      // Default to the earliest "current lesson" among the class's enrolled
      // students (per the per-student progression model), or Lesson 1 if none
      // of them have a progress row yet.
      const { data: memberRows } = await supabase.from("class_members").select("student_id").eq("class_id", classId);
      const studentIds = ((memberRows ?? []) as Pick<ClassMember, "student_id">[]).map((m) => m.student_id);
      let recommended = items[0].id;
      if (studentIds.length > 0) {
        const { data: progressRows } = await supabase
          .from("student_lesson_progress")
          .select("current_item_id")
          .eq("lesson_plan_id", assignRow.lesson_plan_id)
          .in("student_id", studentIds);
        const currentSequences = items
          .filter((i) => (progressRows ?? []).some((p) => p.current_item_id === i.id))
          .map((i) => i.sequence);
        if (currentSequences.length > 0) {
          const minSeq = Math.min(...currentSequences);
          recommended = items.find((i) => i.sequence === minSeq)?.id ?? recommended;
        }
      }
      if (active) setLessonPlanItemId(recommended);
    }

    loadPlanForClass();
    return () => {
      active = false;
    };
  }, [classId]);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile || !classId) return;
    setCreating(true);

    const chosenItem = planItems.find((i) => i.id === lessonPlanItemId);

    const { data: lesson, error } = await supabase
      .from("lessons")
      .insert({
        class_id: classId,
        tutor_id: profile.id,
        title,
        lesson_date: lessonDate,
        start_time: startTime || null,
        duration_minutes: duration,
        quran_surah_key: chosenItem ? chosenItem.quran_surah_key : surahKey || null,
        lesson_plan_item_id: chosenItem?.id ?? null,
      })
      .select()
      .single();

    if (error || !lesson) {
      setCreating(false);
      showToast(error?.message ?? "Could not create lesson");
      return;
    }

    if (meetUrl.trim()) {
      await supabase.from("meetings").insert({
        lesson_id: lesson.id,
        meet_url: meetUrl.trim(),
        scheduled_start: startTime ? `${lessonDate}T${startTime}:00` : null,
      });
    }

    const { data: memberRows } = await supabase.from("class_members").select("student_id").eq("class_id", classId);
    for (const m of (memberRows ?? []) as Pick<ClassMember, "student_id">[]) {
      await notifyUser({
        userId: m.student_id,
        type: "lesson_scheduled",
        title: "New lesson scheduled",
        body: `${title} · ${lessonDate}${startTime ? ` at ${formatTime(startTime)}` : ""}`,
        relatedLessonId: lesson.id,
      });
    }

    setCreating(false);
    showToast("Lesson scheduled");
    setTitle("");
    setMeetUrl("");
    setSurahKey("");
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3.5 sm:grid-cols-2">
      <Field label="Class">
        <Select value={classId} onChange={(e) => setClassId(e.target.value)} required>
          {classes.length === 0 && <option value="">No classes yet</option>}
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Session title">
        <Input required placeholder="Surah Al-Fatiha — Lesson 04" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Date">
        <Input required type="date" value={lessonDate} onChange={(e) => setLessonDate(e.target.value)} />
      </Field>
      <Field label="Time">
        <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
      </Field>
      <Field label="Duration">
        <Select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
          <option value={30}>30 minutes</option>
          <option value={45}>45 minutes</option>
          <option value={60}>60 minutes</option>
        </Select>
      </Field>
      {planItems.length > 0 ? (
        <Field label="Lesson (from the class's curriculum)" hint="Defaults to the earliest current lesson among enrolled students.">
          <Select value={lessonPlanItemId} onChange={(e) => setLessonPlanItemId(e.target.value)}>
            {planItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.sequence}. {i.title}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <Field label="Qur'an content (for live sharing)" hint="This class has no assigned lesson plan yet — set one in Lesson Library.">
          <Select value={surahKey} onChange={(e) => setSurahKey(e.target.value)}>
            <option value="">None</option>
            {QURAN_SURAHS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="sm:col-span-2">
        <Field label="Google Meet link (optional)" hint="Paste a meet.google.com link — no OAuth needed.">
          <Input type="url" placeholder="https://meet.google.com/abc-defg-hij" value={meetUrl} onChange={(e) => setMeetUrl(e.target.value)} />
        </Field>
      </div>
      <Button type="submit" disabled={creating || classes.length === 0} className="sm:col-span-2">
        {creating ? "Saving…" : "Save Lesson"}
      </Button>
    </form>
  );
}
