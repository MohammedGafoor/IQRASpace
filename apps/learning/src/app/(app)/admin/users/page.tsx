"use client";

import { useCallback, useEffect, useState, type SubmitEvent } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import type { AppUser, Role } from "@/lib/types";
import { ADMIN_ROLES, isAdminRole } from "@/lib/roles";
import { friendlyAuthError } from "@/lib/username";
import { Card, SectionHead } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

const ALL_ROLES: Role[] = ["tutor", "student", "guardian", "admin", "super_admin"];
// Roles creatable from this page's "Create user" form — must match
// admin-user-management's CREATABLE_ROLES exactly. admin/super_admin stay
// exclusively on `npm run seed:admins` (see that Edge Function's header
// comment and 0017_admin_super_admin_roles.sql).
const CREATABLE_ROLES: Role[] = ["tutor", "student", "guardian"];

const ROLE_TONE: Record<Role, BadgeTone> = {
  tutor: "teal",
  student: "green",
  guardian: "muted",
  admin: "amber",
  super_admin: "red",
};

/** Calls the admin-user-management Edge Function — the only place in this
 * app that can create/deactivate/delete an Auth user, reset a password, or
 * read real ban status, since those all need the service_role key (never
 * exposed to the browser). `supabase.functions.invoke` attaches the
 * caller's own session token automatically; the function re-checks admin
 * access server-side. */
async function callAdmin(
  action: string,
  params: Record<string, unknown> = {}
): Promise<{ ok: boolean; error?: string; data?: { id?: string; banned?: boolean } }> {
  const { data, error } = await supabase.functions.invoke("admin-user-management", {
    body: { action, ...params },
  });
  if (error) {
    // A non-2xx response surfaces as a generic error with the real JSON
    // body attached to `context` — unwrap it for a useful message.
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const body = await context.json();
        return { ok: false, error: friendlyAuthError(body.error ?? error.message) };
      } catch {
        // fall through to the generic message below
      }
    }
    return { ok: false, error: friendlyAuthError(error.message) };
  }
  return (data as { ok: boolean; error?: string; data?: { id?: string; banned?: boolean } }) ?? {
    ok: false,
    error: "No response from server.",
  };
}

// Every account on the platform. Populated only for admin/super_admin —
// "users_all_as_admin" (0018_admin_full_access.sql) is what actually makes
// this query return more than the caller's own row; a tutor/student opening
// this URL directly would just see themselves (and whatever
// users_select_as_tutor_of_student already grants).
//
// Role changes go through public.set_user_role(), which re-checks
// is_admin() server-side. Create/reset-password/deactivate/delete/status go
// through the admin-user-management Edge Function, which re-checks the
// same thing against a service_role client — the UI hiding a control is
// convenience, not the actual boundary in either case.
export default function AdminUsersPage() {
  return (
    <RequireAuth allow={ADMIN_ROLES}>
      <AdminUsers />
    </RequireAuth>
  );
}

function AdminUsers() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const canManage = isAdminRole(profile?.role);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AppUser | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("tutor");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("users").select("*").order("full_name", { ascending: true });
    if (error) {
      showToast(error.message);
    } else {
      setUsers((data ?? []) as AppUser[]);
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    // Fetch-on-mount via the browser Supabase client — same accepted MVP
    // pattern as classes/page.tsx (see docs/PROGRESS.md Phase 1 notes).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleCreateUser(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const result = await callAdmin("create", {
      username: newUsername,
      email: newEmail || undefined,
      phone: newPhone || undefined,
      password: newPassword,
      fullName: newName || undefined,
      role: newRole,
    });
    setCreating(false);
    if (!result.ok) {
      showToast(result.error ?? "Could not create user");
      return;
    }
    showToast("User created");
    setNewName("");
    setNewUsername("");
    setNewEmail("");
    setNewPhone("");
    setNewPassword("");
    setNewRole("tutor");
    setShowCreate(false);
    load();
  }

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  const filtered = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <SectionHead
          title="Create user"
          subtitle="Tutor, student or guardian accounts only — admin/super_admin are provisioned via npm run seed:admins. Email is optional."
          action={
            <Button variant="outline" size="sm" onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? "Cancel" : "+ New user"}
            </Button>
          }
        />
        {showCreate && (
          <form onSubmit={handleCreateUser} className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Username" hint="What they'll log in with.">
              <Input
                required
                pattern="[a-zA-Z0-9_.-]+"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="e.g. jane_tutor"
              />
            </Field>
            <Field label="Full name">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" />
            </Field>
            <Field label="Email (optional)">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </Field>
            <Field label="Phone (optional)">
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+1 555 0100" />
            </Field>
            <Field label="Temporary password">
              <Input
                type="text"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </Field>
            <Field label="Role">
              <Select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                {CREATABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" disabled={creating} className="sm:col-span-2">
              {creating ? "Creating…" : "Create account"}
            </Button>
          </form>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name, username or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-[280px]"
        />
        <span className="text-sm text-muted">
          {filtered.length} account{filtered.length === 1 ? "" : "s"}
        </span>
        {!canManage && <span className="ml-auto text-xs text-muted">Read-only — only an admin can manage accounts.</span>}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon="🗂️">No accounts match that search.</EmptyState>
        </Card>
      ) : (
        <Card padded={false} className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs font-bold uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{u.full_name}</td>
                  <td className="px-4 py-3 text-ink-soft">@{u.username}</td>
                  <td className="px-4 py-3">
                    <Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {new Date(u.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setEditing(u)}>
                        Edit
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <EditUserForm
            user={editing}
            isSelf={editing.id === profile?.id}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              load();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

// Matches the "Tutor Information" shape requested for this phase — Username,
// Name, Phone, Email, Status, Password/Reset Password — generically for any
// role, since Admin manages every account type the same way for now.
function EditUserForm({
  user,
  isSelf,
  onClose,
  onSaved,
}: {
  user: AppUser;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [username, setUsername] = useState(user.username);
  const [fullName, setFullName] = useState(user.full_name);
  const [email, setEmail] = useState(user.email ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [role, setRole] = useState<Role>(user.role);
  const [saving, setSaving] = useState(false);

  const [banned, setBanned] = useState<boolean | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    callAdmin("status", { userId: user.id }).then((result) => {
      if (!active) return;
      setBanned(result.ok ? (result.data?.banned ?? false) : false);
      setStatusLoading(false);
    });
    return () => {
      active = false;
    };
  }, [user.id]);

  async function handleSave() {
    setSaving(true);
    // Profile fields go straight through PostgREST — users_all_as_admin
    // (0018_admin_full_access.sql) already permits this. Role changes are
    // deliberately NOT included here — they go through set_user_role()
    // below, which re-checks admin access and guards the self-lockout case.
    const { error } = await supabase
      .from("users")
      .update({ username, full_name: fullName, email: email || null, phone: phone || null })
      .eq("id", user.id);
    if (error) {
      setSaving(false);
      showToast(friendlyAuthError(error.message));
      return;
    }
    if (role !== user.role) {
      const { error: roleError } = await supabase.rpc("set_user_role", { p_user_id: user.id, p_new_role: role });
      if (roleError) {
        setSaving(false);
        showToast(roleError.message);
        return;
      }
    }
    setSaving(false);
    showToast("Saved");
    onSaved();
  }

  async function handleResetPassword() {
    const newPassword = window.prompt(`New password for @${user.username}:`);
    if (!newPassword) return;
    setBusy(true);
    const result = await callAdmin("reset_password", { userId: user.id, newPassword });
    setBusy(false);
    showToast(result.ok ? "Password reset" : (result.error ?? "Could not reset password"));
  }

  async function handleToggleActive() {
    const willDeactivate = !banned;
    if (!confirm(`${willDeactivate ? "Deactivate" : "Reactivate"} ${user.full_name}?`)) return;
    setBusy(true);
    const result = await callAdmin(willDeactivate ? "deactivate" : "reactivate", { userId: user.id });
    setBusy(false);
    if (!result.ok) {
      showToast(result.error ?? "Could not update account");
      return;
    }
    setBanned(willDeactivate);
    showToast(willDeactivate ? "Account deactivated" : "Account reactivated");
  }

  async function handleDelete() {
    if (!confirm(`Permanently delete ${user.full_name} (@${user.username})? This cannot be undone.`)) return;
    setBusy(true);
    const result = await callAdmin("delete", { userId: user.id });
    setBusy(false);
    if (!result.ok) {
      showToast(result.error ?? "Could not delete account");
      return;
    }
    showToast("Account deleted");
    onSaved();
  }

  return (
    <div className="flex flex-col gap-3.5">
      <SectionHead
        eyebrow={user.role}
        title={`${user.full_name} Information`}
        subtitle={statusLoading ? "Loading status…" : undefined}
        action={!statusLoading && <Badge tone={banned ? "muted" : "green"}>{banned ? "Deactivated" : "Active"}</Badge>}
      />

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Username">
          <Input
            required
            pattern="[a-zA-Z0-9_.-]+"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field label="Name">
          <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Phone (optional)">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 0100" />
        </Field>
        <Field label="Email (optional)">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={isSelf}>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {isSelf && <p className="-mt-2 text-xs text-muted">You can&rsquo;t change your own role or deactivate/delete yourself.</p>}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
        <Button size="sm" variant="outline" onClick={handleResetPassword} disabled={busy}>
          Reset / Change Password
        </Button>
        {!isSelf && (
          <>
            <Button size="sm" variant="outline" onClick={handleToggleActive} disabled={busy || statusLoading}>
              {banned ? "Reactivate" : "Deactivate"}
            </Button>
            <Button size="sm" variant="danger" onClick={handleDelete} disabled={busy}>
              Delete
            </Button>
          </>
        )}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
