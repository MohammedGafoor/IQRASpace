"use client";

import Link from "next/link";
import { useAuth } from "@/lib/authContext";
import { LinkButton } from "@/components/ui/Button";

// See Sidebar.tsx's identical constant for why this prefix is needed —
// app/icon.tsx is a generated route under this app's own basePath, not a
// next/link/next/image src that gets auto-prefixed.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function PublicHeader() {
  const { session, loading } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-line px-6 py-4">
      <Link href="/" className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- served from app/icon.tsx (a generated route, not a static public/ file) */}
        <img src={`${BASE_PATH}/icon`} alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-[5px]" />
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
