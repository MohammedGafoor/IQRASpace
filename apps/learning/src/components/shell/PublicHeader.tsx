"use client";

import Link from "next/link";
import { useAuth } from "@/lib/authContext";
import { LinkButton } from "@/components/ui/Button";

export function PublicHeader() {
  const { session, loading } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-line px-6 py-4">
      <Link href="/" className="flex items-center gap-2.5">
        <div className="relative h-7 w-7 shrink-0">
          <span className="absolute inset-0 rounded-[5px] border-2 border-accent" />
          <span className="absolute inset-0 rotate-45 rounded-[5px] border-2 border-accent" />
        </div>
        <span className="font-display text-lg font-semibold">IQRASpace</span>
      </Link>
      {!loading && (
        <nav>
          {session ? (
            <LinkButton href="/dashboard" size="sm" variant="outline">
              Go to dashboard
            </LinkButton>
          ) : (
            <div className="flex items-center gap-2">
              <LinkButton href="/login" size="sm" variant="ghost">
                Log in
              </LinkButton>
              <LinkButton href="/signup" size="sm" variant="primary">
                Sign up
              </LinkButton>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
