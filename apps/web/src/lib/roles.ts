import type { Role } from "./types";

// Single source of truth for the admin/super-admin permission split,
// mirroring supabase/migrations/0017_admin_super_admin_roles.sql
// (public.is_admin() / public.is_super_admin()). These are UX helpers only —
// the actual enforcement is server-side, via RLS policies and the
// set_user_role() RPC, which re-check the same thing against the database,
// not against whatever the client sends.

/** Admin oversight (read-only, platform-wide) + everything super_admin has. */
export function isAdminRole(role: Role | undefined | null): boolean {
  return role === "admin" || role === "super_admin";
}

/** The only role allowed to change another user's role (set_user_role()). */
export function isSuperAdminRole(role: Role | undefined | null): boolean {
  return role === "super_admin";
}

export const ADMIN_ROLES: Role[] = ["admin", "super_admin"];
