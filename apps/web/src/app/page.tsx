"use client";

import Link from "next/link";
import { useAuth } from "@/lib/authContext";

export default function Home() {
  const { session, loading } = useAuth();

  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold">IQRASpace</h1>
        <p className="mt-2 text-neutral-500">
          Online Quran learning management — see{" "}
          <code className="rounded bg-black/[.06] px-1.5 py-0.5 text-sm dark:bg-white/[.08]">
            Iqra-space-architecture.md
          </code>{" "}
          for the full architecture.
        </p>
      </div>
      {loading ? null : session ? (
        <nav className="flex gap-4">
          <Link
            href="/dashboard"
            className="rounded-full border border-black/[.08] px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            Go to dashboard
          </Link>
        </nav>
      ) : (
        <nav className="flex gap-4">
          <Link
            href="/login"
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full border border-black/[.08] px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            Sign up
          </Link>
        </nav>
      )}
    </main>
  );
}
