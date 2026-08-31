import { supabase } from "./supabaseClient";
import type { AppUser, ClassMember, ClassRow, Role } from "./types";
import { isAdminRole } from "./roles";

/**
 * Every student a tutor (their own classes) or admin (every tutor's
 * classes — 0018_admin_full_access.sql) manages, one row per (student,
 * class) pair — a student in two classes appears twice, once per class,
 * which is what a scheduling picker needs (it must know *which* class a
 * session's curriculum comes from). Factors out the `classes ->
 * class_members -> users` join already duplicated in students/page.tsx,
 * progress/page.tsx and lessons/page.tsx, for the new scheduling form so a
 * 4th copy isn't added.
 */
export type ManagedStudent = { user: AppUser; classRow: ClassRow };

export async function getManagedStudentRoster(profile: { id: string; role: Role } | null | undefined): Promise<ManagedStudent[]> {
  if (!profile) return [];
  const isTutor = profile.role === "tutor";
  if (!isTutor && !isAdminRole(profile.role)) return [];

  const classesQuery = supabase.from("classes").select("*");
  const { data: classRows } = await (isTutor ? classesQuery.eq("tutor_id", profile.id) : classesQuery);
  const classes = (classRows ?? []) as ClassRow[];
  if (classes.length === 0) return [];

  const classIds = classes.map((c) => c.id);
  const { data: memberRows } = await supabase.from("class_members").select("*").in("class_id", classIds);
  const members = (memberRows ?? []) as ClassMember[];
  if (members.length === 0) return [];

  const studentIds = Array.from(new Set(members.map((m) => m.student_id)));
  const { data: userRows } = await supabase.from("users").select("*").in("id", studentIds);
  const usersById = new Map(((userRows ?? []) as AppUser[]).map((u) => [u.id, u]));
  const classesById = new Map(classes.map((c) => [c.id, c]));

  return members
    .map((m) => {
      const user = usersById.get(m.student_id);
      const classRow = classesById.get(m.class_id);
      return user && classRow ? { user, classRow } : null;
    })
    .filter((row): row is ManagedStudent => row !== null)
    .sort((a, b) => a.user.full_name.localeCompare(b.user.full_name));
}
