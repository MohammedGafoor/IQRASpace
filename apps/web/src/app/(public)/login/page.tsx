"use client";

import { useState, type SubmitEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Role-based redirect (architecture §5 step "Tutor Login -> Dashboard").
    // Both roles land on /dashboard for Phase 1 — it renders different
    // content per role internally.
    router.push("/dashboard");
  }

  return (
    <main className="pattern-geo mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-8">
      <div className="rounded-[var(--radius-l)] border border-line bg-surface p-7 shadow-[var(--shadow-m)]">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Log in to your teaching workspace.</p>
        <form onSubmit={handleSubmit} className="mt-5">
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
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
