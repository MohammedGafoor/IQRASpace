"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import type { Role } from "@/lib/types";

/**
 * Client-side route guard for Phase 1. Redirects to /login when there's no
 * session. Optionally restricts to a set of roles (e.g. tutor-only pages).
 *
 * Note: this is a client-side check only — good enough for the MVP's UX
 * ("don't show a tutor's management screens to a logged-out visitor") but
 * every actual data access is still enforced server-side by RLS regardless
 * of what this component does, so there's no security reliance on it.
 */
export function RequireAuth({
  children,
  allow,
}: {
  children: ReactNode;
  allow?: Role[];
}) {
  const { session, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  if (loading) {
    return <p className="p-8 text-sm text-neutral-500">Loading…</p>;
  }

  if (!session) {
    return null;
  }

  if (allow && profile && !allow.includes(profile.role)) {
    return (
      <p className="p-8 text-sm text-neutral-500">
        This page isn&rsquo;t available for your account type.
      </p>
    );
  }

  return <>{children}</>;
}
