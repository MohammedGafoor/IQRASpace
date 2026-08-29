"use client";

import { useCallback, useEffect, useState, type SubmitEvent } from "react";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import type { AppUser, ClassMember, ClassRow } from "@/lib/types";
import { Card, Eyebrow } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";

export default function ClassesPage() {
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
      const { data: memberRows } = await supabase.from("class_members").select("*").in("class_id", classIds);

      const studentIds = Array.from(new Set((memberRows ?? []).map((m: ClassMember) => m.student_id)));

      let studentUsers: AppUser[] = [];
      if (studentIds.length > 0) {
        const { data: userRows } = await supabase.from("users").select("*").in("id", studentIds);
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
    const { error } = await supabase.from("classes").insert({ tutor_id: profile.id, name: newClassName });
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
    const { error } = await supabase.from("class_members").delete().eq("class_id", classId).eq("student_id", studentId);
    if (error) {
      setError(error.message);
      return;
    }
    load();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Classes</Eyebrow>
          <h1 className="text-2xl font-semibold">Your groups of students</h1>
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}

      {isTutor && (
        <Card>
          <form onSubmit={handleCreateClass} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <Field label="New class name">
                <Input
                  required
                  placeholder="e.g. Tajweed Foundations — Group B"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                />
              </Field>
            </div>
            <Button type="submit" disabled={creating} className="mb-3.5">
              {creating ? "Creating…" : "+ Create Class"}
            </Button>
          </form>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : classes.length === 0 ? (
        <Card>
          <EmptyState icon="📚">{isTutor ? "No classes yet — create one above." : "You're not in any classes yet."}</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {classes.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Eyebrow>{(members[c.id] ?? []).length} students</Eyebrow>
                  <h3 className="text-lg font-semibold">{c.name}</h3>
                </div>
                {isTutor && (
                  <button onClick={() => handleDeleteClass(c.id)} className="text-xs font-semibold text-danger hover:underline">
                    Delete
                  </button>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(members[c.id] ?? []).length === 0 && <span className="text-sm text-muted">No students yet.</span>}
                {(members[c.id] ?? []).map((s) => (
                  <span key={s.id} className="flex items-center gap-2 rounded-full bg-paper-alt py-1 pl-1 pr-3 text-sm">
                    <Avatar name={s.full_name} size={22} />
                    {s.full_name}
                    {isTutor && (
                      <button onClick={() => handleRemoveStudent(c.id, s.id)} aria-label={`Remove ${s.full_name}`} className="text-muted hover:text-danger">
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>

              {isTutor && (
                <form onSubmit={(e) => handleAddStudent(e, c.id)} className="mt-3.5 flex gap-2">
                  <Input
                    type="email"
                    placeholder="Add student by email"
                    value={addStudentEmail[c.id] ?? ""}
                    onChange={(e) => setAddStudentEmail((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  />
                  <Button type="submit" variant="outline" size="sm">
                    Add
                  </Button>
                </form>
              )}
              {addStudentError[c.id] && <p className="mt-1.5 text-xs text-danger">{addStudentError[c.id]}</p>}

              <div className="mt-4 flex flex-wrap gap-2">
                <LinkButton href="/schedule" size="sm" variant="outline">Schedule</LinkButton>
                <LinkButton href="/attendance" size="sm" variant="outline">Attendance</LinkButton>
                <LinkButton href="/lessons" size="sm" variant="outline">Lessons</LinkButton>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
