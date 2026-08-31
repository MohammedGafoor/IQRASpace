"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { Avatar } from "@/components/ui/Avatar";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { pageMetaFor } from "./navConfig";

export function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const pathname = usePathname();
  const { profile } = useAuth();
  const meta = pageMetaFor(pathname);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-line bg-paper px-5 py-4 md:px-7">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          aria-label="Open menu"
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[8px] border border-line text-lg md:hidden"
        >
          ☰
        </button>
        <div>
          <h2 className="text-[1.2rem] font-semibold">{meta.title}</h2>
          <p className="mt-0.5 hidden text-[0.85rem] text-muted sm:block">{meta.subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <NotificationBell />
        <ThemeToggle />
        <Avatar name={profile?.full_name ?? "?"} size={38} />
      </div>
    </header>
  );
}
