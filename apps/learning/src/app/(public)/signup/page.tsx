"use client";

import { useState, type SubmitEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Role } from "@/lib/types";
import { buildAuthEmail, friendlyAuthError } from "@/lib/username";
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
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    // username/full_name/role/contact_email land in auth.users.raw_user_meta_data
    // and are split apart by the handle_new_user trigger
    // (0002_auth_signup_trigger.sql, rewritten by 0019_username_auth.sql) into
    // public.users.username/full_name/role/email (+ tutors/students row).
    // Email is optional — signUp still needs *an* email-shaped identifier for
    // Supabase Auth itself, so a synthetic one is used when none is given.
    const { error } = await supabase.auth.signUp({
      email: buildAuthEmail(username, email),
      password,
      options: { data: { username, full_name: fullName, role, contact_email: email || null } },
    });
    setSubmitting(false);
    if (error) {
      setError(friendlyAuthError(error.message));
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
          <Field label="Username" hint="What you'll log in with — no email needed.">
            <Input
              required
              pattern="[a-zA-Z0-9_.-]+"
              title="Letters, numbers, underscores, dots and hyphens only"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Field>
          <Field label="Email (optional)">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
