"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import { ADMIN_ROLES } from "@/lib/roles";
import { Card, Eyebrow, SectionHead } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/ProgressBar";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

// Platform-wide oversight. Access is gated two ways: this
// <RequireAuth allow={ADMIN_ROLES}> (UX only) and, for real, the
// "*_all_as_admin" RLS policies (0018_admin_full_access.sql, building on
// 0017's original read-only versions) that these queries depend on — a
// tutor/student hitting this page would just get empty results back from
// Supabase, not a client-side illusion of data.
export default function AdminDashboardPage() {
  return (
    <RequireAuth allow={ADMIN_ROLES}>
      <AdminDashboard />
    </RequireAuth>
  );
}

type Counts = { tutors: number; students: number; guardians: number; classes: number; lessons: number };

function AdminDashboard() {
  const { profile } = useAuth();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const [users, classes, lessons] = await Promise.all([
        supabase.from("users").select("role"),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("lessons").select("id", { count: "exact", head: true }),
      ]);
      if (!active) return;
      const roles = (users.data ?? []) as { role: string }[];
      setCounts({
        tutors: roles.filter((r) => r.role === "tutor").length,
        students: roles.filter((r) => r.role === "student").length,
        guardians: roles.filter((r) => r.role === "guardian").length,
        classes: classes.count ?? 0,
        lessons: lessons.count ?? 0,
      });
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <SectionHead
        eyebrow="Platform oversight"
        title={`Welcome, ${profile?.full_name ?? "Admin"}`}
        subtitle={
          profile?.role === "super_admin"
            ? "Super Admin — full access across the platform."
            : "Admin — full access across the platform."
        }
        action={<Badge tone={profile?.role === "super_admin" ? "amber" : "teal"}>{profile?.role}</Badge>}
      />

      {loading || !counts ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard value={counts.tutors} label="Tutors" />
          <StatCard value={counts.students} label="Students" />
          <StatCard value={counts.guardians} label="Guardians" />
          <StatCard value={counts.classes} label="Classes" />
          <StatCard value={counts.lessons} label="Lessons" />
        </div>
      )}

      <Card>
        <Eyebrow>Manage the platform</Eyebrow>
        <p className="mb-4 text-sm text-ink-soft">
          Create, edit, deactivate or delete any account, and assign roles — plus full CRUD across classes, lessons,
          the lesson library, materials and student progress from the same sidebar as a tutor.
        </p>
        <LinkButton href="/admin/users" variant="outline">
          Open Manage Users →
        </LinkButton>
      </Card>
    </div>
  );
}
