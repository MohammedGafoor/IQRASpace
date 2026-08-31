"use client";

import { useState, type SubmitEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isAdminRole } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // Username-based login (0019_username_auth.sql): resolve the username to
    // whatever email Supabase Auth actually has on file for that account
    // (real, or a synthetic one if none was given at signup) via a narrow,
    // anon-callable RPC that only ever returns that one technical value —
    // then sign in with it exactly like before. A generic "invalid" message
    // covers both "no such username" and "wrong password", same as any
    // normal login form, so this doesn't leak which usernames exist.
    const { data: authEmail, error: lookupError } = await supabase.rpc("get_auth_email_for_username", {
      p_username: username,
    });
    if (lookupError || !authEmail) {
      setSubmitting(false);
      setError("Invalid username or password.");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
    if (error) {
      setSubmitting(false);
      setError("Invalid username or password.");
      return;
    }

    // Role-based redirect (architecture §5 step "Tutor Login -> Dashboard").
    // Tutor/student/guardian land on /dashboard, which renders different
    // content per role internally. admin/super_admin (0017_admin_super_admin_
    // roles.sql) land on /admin instead, purely as a landing-page default —
    // every other route is fully reachable and functional for them too
    // (0018_admin_full_access.sql), so nothing else redirects them away.
    const { data: profileRow } = await supabase
      .from("users")
      .select("role")
      .eq("id", data.user!.id)
      .single();
    setSubmitting(false);
    router.push(isAdminRole(profileRow?.role) ? "/admin" : "/dashboard");
  }

  return (
    <main className="pattern-geo mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-8">
      <div className="rounded-[var(--radius-l)] border border-line bg-surface p-7 shadow-[var(--shadow-m)]">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Log in to your teaching workspace.</p>
        <form onSubmit={handleSubmit} className="mt-5">
          <Field label="Username">
            <Input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </Field>
          <Field label="Password">
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <p className="mb-3.5 text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Logging in…" : "Log in"}
          </Button>
        </form>
        <p className="mt-5 text-sm text-muted">
          No account?{" "}
          <Link href="/signup" className="font-semibold text-primary underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
