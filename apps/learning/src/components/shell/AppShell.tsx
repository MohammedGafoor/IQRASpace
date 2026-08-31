"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col md:ml-[264px]">
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-[1180px] flex-1 px-5 py-6 md:px-7">{children}</main>
      </div>
    </div>
  );
}
