"use client";

import { useCallback, useEffect, useState, type SubmitEvent } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import type { AppUser, ClassMember, ClassRow } from "@/lib/types";

export default function ClassesPage() {
  return (
    <RequireAuth>
      <ClassesContent />
    </RequireAuth>
  );
}

function ClassesContent() {
  const { profile } = useAuth();
  const isTutor = profile?.role === "tutor";

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [members, setMembers] = useState<Record<string, AppUser[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newClassName, setNewClassName] = useState("");
  const [creating, setCreating] = useState(false);
  const [addStudentEmail, setAddStudentEmail] = useState<Record<string, string>>({});
  const [addStudentError, setAddStudentError] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data: classRows, error: classError } = await supabase
      .from("classes")
      .select("*")
      .order("created_at", { ascending: false });

    if (classError) {
      setError(classError.message);
      setLoading(false);
      return;
    }
    setError(null);
    setClasses(classRows ?? []);

    if (classRows && classRows.length > 0) {
      const classIds = classRows.map((c) => c.id);
      const { data: memberRows } = await supabase
        .from("class_members")
        .select("*")
        .in("class_id", classIds);

      const studentIds = Array.from(
        new Set((memberRows ?? []).map((m: ClassMember) => m.student_id))
      );

      let studentUsers: AppUser[] = [];
      if (studentIds.length > 0) {
        const { data: userRows } = await supabase
          .from("users")
          .select("*")
          .in("id", studentIds);
        studentUsers = userRows ?? [];
      }

      const byClass: Record<string, AppUser[]> = {};
      for (const m of memberRows ?? []) {
        const user = studentUsers.find((u) => u.id === m.student_id);
        if (!user) continue;
        (byClass[m.class_id] ??= []).push(user);
      }
      setMembers(byClass);
    } else {
      setMembers({});
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    // Fetch-on-mount via the browser Supabase client — the accepted MVP
    // pattern here (see docs/PROGRESS.md Phase 1 notes); revisit with
    // Server Components or a fetching library if this grows past Phase 1.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleCreateClass(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;
    setCreating(true);
    const { error } = await supabase
      .from("classes")
      .insert({ tutor_id: profile.id, name: newClassName });
    setCreating(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNewClassName("");
    load();
  }

  async function handleDeleteClass(classId: string) {
    if (!confirm("Delete this class? This also removes its lessons and roster.")) return;
    const { error } = await supabase.from("classes").delete().eq("id", classId);
    if (error) {
      setError(error.message);
      return;
    }
    load();
  }

  async function handleAddStudent(e: SubmitEvent<HTMLFormElement>, classId: string) {
    e.preventDefault();
    const email = addStudentEmail[classId]?.trim();
    if (!email) return;
    setAddStudentError((prev) => ({ ...prev, [classId]: "" }));
    const { error } = await supabase.rpc("add_student_to_class", {
      p_class_id: classId,
      p_student_email: email,
    });
    if (error) {
      setAddStudentError((prev) => ({ ...prev, [classId]: error.message }));
      return;
    }
    setAddStudentEmail((prev) => ({ ...prev, [classId]: "" }));
    load();
  }

  async function handleRemoveStudent(classId: string, studentId: string) {
    const { error } = await supabase
      .from("class_members")
      .delete()
      .eq("class_id", classId)
      .eq("student_id", studentId);
    if (error) {
      setError(error.message);
      return;
    }
    load();
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Classes</h1>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {isTutor && (
        <form onSubmit={handleCreateClass} className="mt-6 flex gap-2">
          <input
            required
            placeholder="New class name (e.g. Tajweed Basics)"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            className="flex-1 rounded border border-black/[.15] px-3 py-2 text-sm dark:border-white/[.2] dark:bg-transparent"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create class"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-neutral-500">Loading…</p>
      ) : classes.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">
          {isTutor ? "No classes yet — create one above." : "You're not in any classes yet."}
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {classes.map((c) => (
            <li key={c.id} className="rounded border border-black/[.08] p-4 dark:border-white/[.145]">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{c.name}</h2>
                {isTutor && (
                  <button
                    onClick={() => handleDeleteClass(c.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
              <ul className="mt-2 flex flex-wrap gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                {(members[c.id] ?? []).length === 0 && <li>No students yet.</li>}
                {(members[c.id] ?? []).map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-1 rounded-full bg-black/[.05] px-3 py-1 dark:bg-white/[.08]"
                  >
                    {s.full_name}
                    {isTutor && (
                      <button
                        onClick={() => handleRemoveStudent(c.id, s.id)}
                        aria-label={`Remove ${s.full_name}`}
                        className="text-neutral-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {isTutor && (
                <form
                  onSubmit={(e) => handleAddStudent(e, c.id)}
                  className="mt-3 flex gap-2"
                >
                  <input
                    type="email"
                    placeholder="Student's email"
                    value={addStudentEmail[c.id] ?? ""}
                    onChange={(e) =>
                      setAddStudentEmail((prev) => ({ ...prev, [c.id]: e.target.value }))
                    }
                    className="flex-1 rounded border border-black/[.15] px-2 py-1 text-sm dark:border-white/[.2] dark:bg-transparent"
                  />
                  <button
                    type="submit"
                    className="rounded-full border border-black/[.15] px-3 py-1 text-sm hover:bg-black/[.04] dark:border-white/[.2] dark:hover:bg-[#1a1a1a]"
                  >
                    Add
                  </button>
                </form>
              )}
              {addStudentError[c.id] && (
                <p className="mt-1 text-xs text-red-600">{addStudentError[c.id]}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
