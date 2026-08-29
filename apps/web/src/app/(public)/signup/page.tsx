"use client";

import { useState, type SubmitEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Role } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";

// Guardian is a Phase 2 fast-follow (architecture §4/§17) — not offered here yet.
const ROLES: { value: Extract<Role, "tutor" | "student">; label: string }[] = [
  { value: "tutor", label: "Tutor" },
  { value: "student", label: "Student" },
];

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    // full_name/role land in auth.users.raw_user_meta_data and are copied into
    // public.users (+ tutors/students) by the handle_new_user trigger
    // (supabase/migrations/0002_auth_signup_trigger.sql).
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="pattern-geo mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-8">
      <div className="rounded-[var(--radius-l)] border border-line bg-surface p-7 shadow-[var(--shadow-m)]">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-muted">Join as a tutor or a student.</p>
        <form onSubmit={handleSubmit} className="mt-5">
          <Field label="I am a…">
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Full name">
            <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <p className="mb-3.5 text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Creating account…" : "Sign up"}
          </Button>
        </form>
        <p className="mt-5 text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
