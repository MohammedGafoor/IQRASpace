// Provisions the local Admin / Super Admin accounts from .env.local.
//
// Why a script and not the signup form: public signup can never create an
// admin/super_admin account (see the handle_new_user() whitelist in
// supabase/migrations/0017_admin_super_admin_roles.sql) — that's
// deliberate, so the only way in is a trusted, service_role-authenticated
// path run locally by a developer, never from the browser.
//
// Usage (from apps/learning):
//   npm run seed:admins
// (runs `node --env-file=.env.local scripts/seed-admin-accounts.mjs` —
// requires ADMIN_EMAIL/ADMIN_PASSWORD, SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD
// and SUPABASE_SERVICE_ROLE_KEY to be set in .env.local first.)
//
// Idempotent: re-running it just resets the password and re-asserts the
// role for each account, so it's safe to run again after editing .env.local.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Guards against a real gotcha this project hit twice: this script runs via
// `node --env-file=.env.local`, and Node's --env-file parser truncates a
// value at an unquoted `#` mid-line (ADMIN_PASSWORD=Foo#123 silently becomes
// "Foo") — so the account ends up with a different password than what's
// visibly in the file. Re-parse the raw file ourselves for these two keys
// and fail loudly if what Node handed us doesn't match what's actually
// written there, rather than silently provisioning a truncated password.
function checkForSilentTruncation(varName) {
  let raw;
  try {
    raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return; // can't double-check without the file; --env-file already validated it exists
  }
  const line = raw.split("\n").find((l) => l.trim().startsWith(`${varName}=`));
  if (!line) return;
  const rawValue = line.slice(line.indexOf("=") + 1).trim();
  const isQuoted = /^"(.*)"$/.test(rawValue) || /^'(.*)'$/.test(rawValue);
  // An unquoted value containing '#' is exactly what --env-file truncates —
  // don't try to re-derive its result and compare (that's tautological,
  // since we'd just be reimplementing the same truncation); the presence of
  // an unquoted '#' is itself the bug, regardless of what leaked through.
  if (!isQuoted && rawValue.includes("#")) {
    fail(
      `${varName} in .env.local contains a '#' that got truncated when read ` +
        `(Node's --env-file treats an unquoted '#' as a comment start, mid-line).\n` +
        `  Either remove the '#' from the password, or wrap the whole value in double quotes:\n` +
        `  ${varName}="...#..."`
    );
  }
}

const ACCOUNTS = [
  {
    role: "admin",
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    fullName: "Admin",
    username: "admin",
  },
  {
    role: "super_admin",
    email: process.env.SUPER_ADMIN_EMAIL,
    password: process.env.SUPER_ADMIN_PASSWORD,
    fullName: "Super Admin",
    username: "superadmin",
  },
];

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!SUPABASE_URL) {
  fail("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local.");
}
if (!SERVICE_ROLE_KEY) {
  fail(
    "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
      "  Find it under Supabase Dashboard -> Project Settings -> API (the\n" +
      "  'service_role' secret key) and set it locally — never commit it,\n" +
      "  never prefix it with NEXT_PUBLIC_, never use it from browser code."
  );
}
for (const acct of ACCOUNTS) {
  if (!acct.email || !acct.password) {
    fail(
      `Missing ${acct.role === "admin" ? "ADMIN_EMAIL/ADMIN_PASSWORD" : "SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD"} in .env.local.`
    );
  }
  if (acct.password.length < 6) {
    fail(`${acct.role} password must be at least 6 characters (Supabase Auth's minimum).`);
  }
}
checkForSilentTruncation("ADMIN_PASSWORD");
checkForSilentTruncation("SUPER_ADMIN_PASSWORD");
if (ACCOUNTS[0].email.toLowerCase() === ACCOUNTS[1].email.toLowerCase()) {
  fail("ADMIN_EMAIL and SUPER_ADMIN_EMAIL must be different accounts.");
}

// service_role key -> every request bypasses RLS and is recognized by
// 0017's prevent_role_self_escalation() trigger via auth.role() =
// 'service_role', so it's allowed to set `role` directly without going
// through set_user_role().
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserIdByEmail(email) {
  // supabase-js v2 has no admin.getUserByEmail — page through admin.listUsers().
  const perPage = 200;
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < perPage) return null;
  }
  return null;
}

async function upsertAccount({ role, email, password, fullName, username }) {
  let userId = await findUserIdByEmail(email);

  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) throw error;
    console.log(`  existing auth user found (${email}) — password reset`);
  } else {
    // handle_new_user() (0017/0019) coerces this metadata role to 'student'
    // since 'admin'/'super_admin' are never trusted from signup metadata —
    // that's fixed up below with a direct, service_role-authenticated
    // update. `username` is required by the trigger (0019) regardless of role.
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "student", username },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`  created new auth user (${email})`);
  }

  const { error: roleError } = await admin
    .from("users")
    .update({ role, full_name: fullName, username })
    .eq("id", userId);
  if (roleError) throw roleError;

  // handle_new_user() may have inserted a stray tutors/students row for the
  // 'student' fallback role above — admin/super_admin accounts shouldn't
  // have either. Harmless to attempt even if no such row exists.
  await admin.from("students").delete().eq("id", userId);
  await admin.from("tutors").delete().eq("id", userId);

  console.log(`  ✓ ${email} -> role: ${role}`);
}

for (const acct of ACCOUNTS) {
  console.log(`\n${acct.role}:`);
  await upsertAccount(acct);
}

console.log("\nDone. Log in at /login with the email/password from .env.local.\n");
