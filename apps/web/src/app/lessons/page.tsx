"use client";

import { useCallback, useEffect, useState, type SubmitEvent } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import type { ClassRow, Lesson, LessonStatus } from "@/lib/types";

const STATUS_OPTIONS: LessonStatus[] = ["scheduled", "active", "completed", "cancelled"];

export default function LessonsPage() {
  return (
    <RequireAuth>
      <LessonsContent />
    </RequireAuth>
  );
}

function LessonsContent() {
  const { profile } = useAuth();
  const isTutor = profile?.role === "tutor";

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [lessonDate, setLessonDate] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [{ data: classRows, error: classError }, { data: lessonRows, error: lessonError }] =
      await Promise.all([
        supabase.from("classes").select("*").order("name"),
        supabase.from("lessons").select("*").order("lesson_date", { ascending: false }),
      ]);

    setError(classError?.message ?? lessonError?.message ?? null);
    setClasses(classRows ?? []);
    setLessons(lessonRows ?? []);
    if (!classId && classRows && classRows.length > 0) setClassId(classRows[0].id);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Fetch-on-mount via the browser Supabase client — the accepted MVP
    // pattern here (see docs/PROGRESS.md Phase 1 notes); revisit with
    // Server Components or a fetching library if this grows past Phase 1.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleCreateLesson(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile || !classId) return;
    setCreating(true);
    const { error } = await supabase.from("lessons").insert({
      class_id: classId,
      tutor_id: profile.id,
      title,
      lesson_date: lessonDate,
    });
    setCreating(false);
    if (error) {
      setError(error.message);
      return;
    }
    setTitle("");
    setLessonDate("");
    load();
  }

  async function handleStatusChange(lessonId: string, status: LessonStatus) {
    const { error } = await supabase.from("lessons").update({ status }).eq("id", lessonId);
    if (error) {
      setError(error.message);
      return;
    }
    load();
  }

  async function handleDeleteLesson(lessonId: string) {
    if (!confirm("Delete this lesson?")) return;
    const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
    if (error) {
      setError(error.message);
      return;
    }
    load();
  }

  function classNameFor(id: string) {
    return classes.find((c) => c.id === id)?.name ?? "Unknown class";
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Lessons</h1>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {isTutor && (
        <form onSubmit={handleCreateLesson} className="mt-6 flex flex-col gap-2 sm:flex-row">
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            required
            className="rounded border border-black/[.15] px-3 py-2 text-sm dark:border-white/[.2] dark:bg-transparent"
          >
            {classes.length === 0 && <option value="">No classes yet</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Lesson title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 rounded border border-black/[.15] px-3 py-2 text-sm dark:border-white/[.2] dark:bg-transparent"
          />
          <input
            required
            type="date"
            value={lessonDate}
            onChange={(e) => setLessonDate(e.target.value)}
            className="rounded border border-black/[.15] px-3 py-2 text-sm dark:border-white/[.2] dark:bg-transparent"
          />
          <button
            type="submit"
            disabled={creating || classes.length === 0}
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create lesson"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-neutral-500">Loading…</p>
      ) : lessons.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">No lessons yet.</p>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <thead className="text-neutral-500">
            <tr>
              <th className="pb-2 font-normal">Date</th>
              <th className="pb-2 font-normal">Title</th>
              <th className="pb-2 font-normal">Class</th>
              <th className="pb-2 font-normal">Status</th>
              {isTutor && <th className="pb-2 font-normal" />}
            </tr>
          </thead>
          <tbody>
            {lessons.map((l) => (
              <tr key={l.id} className="border-t border-black/[.06] dark:border-white/[.1]">
                <td className="py-2">{l.lesson_date}</td>
                <td className="py-2">{l.title}</td>
                <td className="py-2">{classNameFor(l.class_id)}</td>
                <td className="py-2">
                  {isTutor ? (
                    <select
                      value={l.status}
                      onChange={(e) =>
                        handleStatusChange(l.id, e.target.value as LessonStatus)
                      }
                      className="rounded border border-black/[.15] bg-transparent px-2 py-1 text-xs dark:border-white/[.2]"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    l.status
                  )}
                </td>
                {isTutor && (
                  <td className="py-2 text-right">
                    <button
                      onClick={() => handleDeleteLesson(l.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
