"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Field, Select } from "@/components/ui/Field";

type TutorOption = { id: string; full_name: string };

/**
 * An admin/super_admin has no `tutors` row of their own, so wherever a
 * tutor would normally create a row that needs `tutor_id` (a class, a
 * lesson plan), an admin has to say *whose* it is instead. Rendered only
 * when the caller isn't a tutor themselves (see each call site's
 * `!isTutor && canManage` gate) — `users_all_as_admin`
 * (0018_admin_full_access.sql) is what makes this query return every
 * tutor, not just the caller's own row.
 */
export function TutorPicker({
  value,
  onChange,
  label = "Tutor",
}: {
  value: string | null;
  onChange: (tutorId: string) => void;
  label?: string;
}) {
  const [tutors, setTutors] = useState<TutorOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("users")
      .select("id, full_name")
      .eq("role", "tutor")
      .order("full_name", { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        const rows = (data ?? []) as TutorOption[];
        setTutors(rows);
        if (!value && rows[0]) onChange(rows[0].id);
        setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Field label={label} hint="Acting on behalf of this tutor">
      <Select value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={loading}>
        {loading && <option value="">Loading…</option>}
        {!loading && tutors.length === 0 && <option value="">No tutors yet</option>}
        {tutors.map((t) => (
          <option key={t.id} value={t.id}>
            {t.full_name}
          </option>
        ))}
      </Select>
    </Field>
  );
}
