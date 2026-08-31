"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import { Avatar } from "@/components/ui/Avatar";
import { isAdminRole } from "@/lib/roles";
import { ADMIN_NAV_ITEMS, NAV_ITEMS } from "./navConfig";

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuth();
  // Admin/super_admin get a separate, smaller nav — see navConfig.ts.
  const navItems = isAdminRole(profile?.role) ? ADMIN_NAV_ITEMS : NAV_ITEMS;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-[35] bg-black/45 transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-primary-deep text-[#eaf3f0] transition-transform md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="absolute right-3.5 top-4 text-lg text-white md:hidden"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <div className="relative h-8 w-8 shrink-0">
            <span className="absolute inset-0 rounded-[6px] border-2 border-accent" />
            <span className="absolute inset-0 rotate-45 rounded-[6px] border-2 border-accent" />
          </div>
          <div>
            <b className="block font-display text-[1.05rem] font-semibold text-white">IQRASpace</b>
            <small className="block text-[0.72rem] tracking-wide text-[#afc9c2]">Online teaching workspace</small>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2.5">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`mb-0.5 flex items-center gap-2.5 rounded-[10px] border-l-[3px] px-3 py-2.5 text-[0.86rem] font-medium ${
                  active
                    ? "border-accent bg-white/10 font-bold text-white"
                    : "border-transparent text-[#cfe3de] hover:bg-white/[.08] hover:text-white"
                }`}
              >
                <span className="w-5 text-center text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-5 py-4">
          <div className="mb-2.5 flex items-center gap-2.5">
            <Avatar name={profile?.full_name ?? "?"} size={34} />
            <div>
              <b className="block text-[0.82rem] text-white">{profile?.full_name ?? "…"}</b>
              <small className="text-[0.72rem] text-[#afc9c2] capitalize">{profile?.role}</small>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-[0.75rem] text-[#afc9c2] underline underline-offset-2 hover:text-white"
          >
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
