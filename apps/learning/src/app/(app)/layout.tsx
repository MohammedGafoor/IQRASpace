import type { ReactNode } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/shell/AppShell";

// Route group — doesn't affect URLs. Every authenticated screen (dashboard,
// classes, lessons, students, materials, schedule, attendance, progress,
// notes, meet, notifications, settings, teach, admin) shares this shell +
// auth guard, so individual pages no longer need to wrap themselves in
// <RequireAuth>. `/share/[lessonId]` deliberately lives outside this group —
// students following a live lesson get a minimal, chrome-free view instead
// (architecture §18).
//
// admin/super_admin no longer get redirected off these routes (see
// docs/PROGRESS.md's admin full-access phase) — every one of them is now a
// genuine, working platform-wide view for an admin, not just a tutor
// workspace, so there's nothing left to bounce them away from.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
