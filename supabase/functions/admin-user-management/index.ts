// Edge Function: admin-user-management
//
// The only privileged (service_role) user-management surface in the app —
// mirrors the auth pattern already established by google-oauth-exchange /
// drive-file-proxy: verify the caller's own session token server-side
// (never trust a client-sent role/id), then act with a service_role
// client. Single route, one action discriminator, no separate CRUD
// framework — this app has no other server-side code beyond those two
// functions and RLS; this is the minimal addition needed because creating/
// deleting Supabase Auth users and resetting passwords requires
// auth.admin.* calls, which structurally cannot be made from the browser
// without leaking the service_role key.
//
// Called as: POST /admin-user-management
// Authorization: Bearer <supabase access token> (the caller's own session)
// Body: { action: "create" | "reset_password" | "deactivate" | "reactivate" | "delete" | "status", ...params }
//
// Username-based auth (0019_username_auth.sql): `create` takes `username`
// (required) instead of `email` (now optional, contact-only) — handle_new_user()
// builds the real Auth email itself from whichever the client passed as
// `email` in the auth.admin.createUser() call below (real, if `email` was
// given; a synthetic `<username>@users.iqraspace.internal` otherwise, built
// client-side by lib/username.ts's buildAuthEmail() — kept in sync with that).
//
// admin/super_admin accounts are deliberately NOT creatable through this
// function — that stays exclusively on `npm run seed:admins`
// (scripts/seed-admin-accounts.mjs), preserving the boundary
// 0017_admin_super_admin_roles.sql already drew (see its handle_new_user()
// comment: those two roles are "never grantable through public signup").

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Roles this function may CREATE. admin/super_admin are provisioned only
// via npm run seed:admins (service_role, run locally) — see header comment.
const CREATABLE_ROLES = ["tutor", "student", "guardian"];

// Supabase Auth's ban mechanism has no permanent-ban sentinel; "876000h"
// (100 years) is the documented convention for "indefinite" — undone by
// passing ban_duration: "none".
const INDEFINITE_BAN = "876000h";

// Kept in sync with apps/web/src/lib/username.ts's SYNTHETIC_EMAIL_DOMAIN —
// used only for admin-created accounts (below); the signup page resolves
// its own synthetic email client-side since it calls auth.signUp() directly,
// not this function.
const SYNTHETIC_EMAIL_DOMAIN = "users.iqraspace.internal";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ ok: false, error: "Missing Authorization header." }, 401);
  }
  const accessToken = authHeader.slice("Bearer ".length);

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Identify the caller from their own session token, then re-check their
  // role directly against the database — the same boundary is_admin()
  // enforces for RLS. Never trust a client-supplied role/id.
  const {
    data: { user: caller },
    error: callerError,
  } = await supabaseAdmin.auth.getUser(accessToken);
  if (callerError || !caller) return json({ ok: false, error: "Invalid session." }, 401);

  const { data: callerProfile } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", caller.id)
    .maybeSingle();
  if (!callerProfile || !["admin", "super_admin"].includes(callerProfile.role)) {
    return json({ ok: false, error: "Not authorized — admin access required." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }
  const action = body.action as string | undefined;

  switch (action) {
    case "create": {
      const username = body.username as string | undefined;
      const password = body.password as string | undefined;
      const fullName = (body.fullName as string | undefined) ?? username;
      const role = body.role as string | undefined;
      const contactEmail = (body.email as string | undefined)?.trim() || null;
      const phone = (body.phone as string | undefined)?.trim() || null;
      if (!username || !password || !role) {
        return json({ ok: false, error: "username, password and role are required." }, 400);
      }
      if (!CREATABLE_ROLES.includes(role)) {
        return json(
          {
            ok: false,
            error: "role must be one of: tutor, student, guardian (admin/super_admin are provisioned via npm run seed:admins).",
          },
          400
        );
      }
      // handle_new_user() (0002/0017/0019) reads this metadata and creates
      // the matching public.users/tutors/students rows — reuse it rather
      // than duplicating that insert logic here. Contact email is optional;
      // Supabase Auth itself still needs an email-shaped identifier, so a
      // synthetic one is used when none is given.
      const authEmail = contactEmail ?? `${username}@${SYNTHETIC_EMAIL_DOMAIN}`;
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
        user_metadata: { username, full_name: fullName, role, contact_email: contactEmail },
      });
      if (error) return json({ ok: false, error: error.message }, 400);
      if (phone) {
        await supabaseAdmin.from("users").update({ phone }).eq("id", data.user.id);
      }
      return json({ ok: true, data: { id: data.user.id } });
    }

    // Real Active/Deactivated status — auth.users.banned_until isn't exposed
    // through PostgREST, so the Edit-user UI fetches it through here rather
    // than guessing from session-local state.
    case "status": {
      const userId = body.userId as string | undefined;
      if (!userId) return json({ ok: false, error: "userId is required." }, 400);
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (error) return json({ ok: false, error: error.message }, 400);
      const bannedUntil = data.user?.banned_until;
      const banned = !!bannedUntil && new Date(bannedUntil).getTime() > Date.now();
      return json({ ok: true, data: { banned } });
    }

    case "reset_password": {
      const userId = body.userId as string | undefined;
      const newPassword = body.newPassword as string | undefined;
      if (!userId || !newPassword) {
        return json({ ok: false, error: "userId and newPassword are required." }, 400);
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
      if (error) return json({ ok: false, error: error.message }, 400);
      return json({ ok: true });
    }

    case "deactivate":
    case "reactivate": {
      const userId = body.userId as string | undefined;
      if (!userId) return json({ ok: false, error: "userId is required." }, 400);
      if (userId === caller.id) return json({ ok: false, error: "Cannot deactivate your own account." }, 400);
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: action === "deactivate" ? INDEFINITE_BAN : "none",
      });
      if (error) return json({ ok: false, error: error.message }, 400);
      return json({ ok: true });
    }

    case "delete": {
      const userId = body.userId as string | undefined;
      if (!userId) return json({ ok: false, error: "userId is required." }, 400);
      if (userId === caller.id) return json({ ok: false, error: "Cannot delete your own account." }, 400);
      // No FK exists from public.users to auth.users (see 0001/0002) — the
      // domain row is deleted first (cascades tutors/students/classes/...
      // per their own ON DELETE CASCADE FKs), then the Auth user, explicitly
      // and in that order.
      const { error: domainError } = await supabaseAdmin.from("users").delete().eq("id", userId);
      if (domainError) return json({ ok: false, error: domainError.message }, 400);
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authError) return json({ ok: false, error: authError.message }, 400);
      return json({ ok: true });
    }

    default:
      return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  }
});
