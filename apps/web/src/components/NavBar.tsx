"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/classes", label: "Classes" },
  { href: "/lessons", label: "Lessons" },
];

export function NavBar() {
  const { session, profile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Keep the auth pages themselves chrome-free.
  if (pathname === "/login" || pathname === "/signup") return null;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="flex items-center justify-between border-b border-black/[.08] px-6 py-3 dark:border-white/[.145]">
      <Link href="/" className="font-semibold">
        IQRASpace
      </Link>
      {session && (
        <nav className="flex items-center gap-4 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                pathname.startsWith(l.href)
                  ? "font-medium text-black dark:text-white"
                  : "text-neutral-500 hover:text-black dark:hover:text-white"
              }
            >
              {l.label}
            </Link>
          ))}
          {profile && (
            <span className="text-neutral-400">
              {profile.full_name} ({profile.role})
            </span>
          )}
          <button
            onClick={handleLogout}
            className="rounded-full border border-black/[.08] px-3 py-1 text-sm hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            Log out
          </button>
        </nav>
      )}
    </header>
  );
}
