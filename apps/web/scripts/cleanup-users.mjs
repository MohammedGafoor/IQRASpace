// ONE-OFF cleanup script (Phase 3): trims the accumulated QA/manual-testing
// accounts down to exactly 4 — 1 admin, 1 super_admin, 1 tutor, 1 student —
// and backfills real `username`s for the ones that survive. Not meant to be
// re-run routinely (unlike seed-admin-accounts.mjs); safe to re-run though,
// since every step is keyed by fixed IDs and is idempotent (delete-if-exists,
// upsert-by-id).
//
// Usage (from apps/web): node --env-file=.env.local scripts/cleanup-users.mjs
//
// What survives, and why (decided with the project owner after inventorying
// the live DB — see docs/PROGRESS.md's Phase 3 entry for the full reasoning):
//   - admin.demo@iqraspace.com       (admin)       — the seeded admin account
//   - superadmin.demo@iqraspace.com  (super_admin) — the seeded super_admin account
//   - shaheen@iqraspace.com          (tutor)       — holds the only real
//     content in the whole DB: a complete 52-lesson Qaida curriculum
//     (lesson_plan_items) and a "Quran" class. Kept over the originally-
//     documented qaida.tutor@iqraspace.demo (which only had a 1-item stub
//     plan, despite owning the actual uploaded PDF in Storage).
//   - one existing student row, repurposed as a generic "Demo Student" and
//     enrolled into Shaheen's class (no student account had any real
//     progress/attendance data to prefer one over another).
// Every other account (23 total at the time this ran) is deleted, cascading
// their classes/lessons/tutors/students rows via the existing FK
// ON DELETE CASCADE chain (0001_init_schema.sql).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "lesson-materials";

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}
if (!SUPABASE_URL) fail("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local.");
if (!SERVICE_ROLE_KEY) fail("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local.");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Fixed IDs from the live-DB inventory taken this session — not looked up
// dynamically, so this script does exactly one specific, reviewed thing
// rather than a generic "keep whatever looks newest" heuristic.
const KEEP_TUTOR_ID = "8757b7db-64a4-4cea-b60f-090a284803b3"; // shaheen@iqraspace.com
const OLD_DEMO_TUTOR_ID = "580c9003-f32a-4319-9144-6463e39f592f"; // qaida.tutor@iqraspace.demo — owns the uploaded PDFs, being deleted
const KEEP_STUDENT_ID = "e2019ed5-6560-4563-8824-959ac9b65cff"; // was "Test Student" — repurposed
const SHAHEEN_CLASS_ID = "581fbd10-11ee-472f-8f43-ed48f9f0bfd7"; // "Quran"
const SHAHEEN_PLAN_ID = "5f1b697e-0269-4114-95f5-0af3506ffc5c"; // the real 52-item plan

async function main() {
  const { data: allUsers, error: listError } = await admin.from("users").select("id, email, role, full_name");
  if (listError) throw listError;
  console.log(`Found ${allUsers.length} users before cleanup.`);

  const keepIds = new Set();
  // admin/super_admin: whichever rows currently hold those roles (there
  // should be exactly one of each already, from seed-admin-accounts.mjs).
  for (const u of allUsers) {
    if (u.role === "admin" || u.role === "super_admin") keepIds.add(u.id);
  }
  keepIds.add(KEEP_TUTOR_ID);
  keepIds.add(KEEP_STUDENT_ID);

  const toDelete = allUsers.filter((u) => !keepIds.has(u.id));
  console.log(`Keeping ${keepIds.size} accounts, deleting ${toDelete.length}.\n`);

  // ── 1. Move the real curriculum's storage files onto the surviving
  // tutor's folder before the old tutor's row (and, later, its folder) is
  // gone. ────────────────────────────────────────────────────────────────
  const { data: oldFiles, error: listFilesError } = await admin.storage.from(BUCKET).list(OLD_DEMO_TUTOR_ID);
  if (listFilesError) throw listFilesError;
  const { data: newFiles, error: listNewError } = await admin.storage.from(BUCKET).list(KEEP_TUTOR_ID);
  if (listNewError) throw listNewError;
  const alreadyCopied = new Set((newFiles ?? []).filter((f) => f.id).map((f) => f.name));
  for (const f of oldFiles ?? []) {
    if (!f.id) continue; // folder placeholder entry
    const fromPath = `${OLD_DEMO_TUTOR_ID}/${f.name}`;
    const toPath = `${KEEP_TUTOR_ID}/${f.name}`;
    if (alreadyCopied.has(f.name)) {
      console.log(`  storage: ${toPath} already exists, skipping copy`);
      continue;
    }
    const { error: copyError } = await admin.storage.from(BUCKET).copy(fromPath, toPath);
    if (copyError) throw new Error(`copy ${fromPath} -> ${toPath}: ${copyError.message}`);
    console.log(`  storage: copied ${fromPath} -> ${toPath}`);
  }

  // Re-point every lesson_plan_item that referenced the old tutor's folder.
  const { data: items, error: itemsError } = await admin
    .from("lesson_plan_items")
    .select("id, material_storage_path")
    .eq("lesson_plan_id", SHAHEEN_PLAN_ID);
  if (itemsError) throw itemsError;
  let repointed = 0;
  for (const item of items ?? []) {
    if (item.material_storage_path?.startsWith(`${OLD_DEMO_TUTOR_ID}/`)) {
      const newPath = item.material_storage_path.replace(OLD_DEMO_TUTOR_ID, KEEP_TUTOR_ID);
      const { error } = await admin.from("lesson_plan_items").update({ material_storage_path: newPath }).eq("id", item.id);
      if (error) throw error;
      repointed++;
    }
  }
  console.log(`  storage: repointed ${repointed} lesson_plan_items to the new folder.\n`);

  // ── 2. Enroll the kept student into Shaheen's class. ────────────────────
  const { error: enrollError } = await admin
    .from("class_members")
    .upsert({ class_id: SHAHEEN_CLASS_ID, student_id: KEEP_STUDENT_ID }, { onConflict: "class_id,student_id" });
  if (enrollError) throw enrollError;
  console.log("  enrolled the kept student into Shaheen's Quran class.\n");

  // ── 3. Set clean usernames/profile fields on the 4 survivors. ───────────
  for (const u of allUsers) {
    if (u.role === "admin") {
      await admin.from("users").update({ username: "admin" }).eq("id", u.id);
    } else if (u.role === "super_admin") {
      await admin.from("users").update({ username: "superadmin" }).eq("id", u.id);
    }
  }
  await admin.from("users").update({ username: "shaheen" }).eq("id", KEEP_TUTOR_ID);
  await admin
    .from("users")
    .update({ username: "student", full_name: "Demo Student", email: null })
    .eq("id", KEEP_STUDENT_ID);
  console.log("  set usernames: admin, superadmin, shaheen, student.\n");

  // ── 4. Delete every other account — public.users row first (cascades
  // tutors/students/classes/lessons/lesson_plans/etc.), then the matching
  // Auth user (no FK from public.users to auth.users, so both need an
  // explicit delete — same as admin-user-management's `delete` action). ──
  for (const u of toDelete) {
    const { error: domainError } = await admin.from("users").delete().eq("id", u.id);
    if (domainError) throw new Error(`delete public.users ${u.id} (${u.email}): ${domainError.message}`);
    const { error: authError } = await admin.auth.admin.deleteUser(u.id);
    if (authError) throw new Error(`delete auth user ${u.id} (${u.email}): ${authError.message}`);
    console.log(`  deleted ${u.role} ${u.email} (${u.id})`);
  }

  // ── 5. Remove the now-empty old tutor folder from Storage. ──────────────
  if (oldFiles?.length) {
    const paths = oldFiles.filter((f) => f.id).map((f) => `${OLD_DEMO_TUTOR_ID}/${f.name}`);
    const { error: removeError } = await admin.storage.from(BUCKET).remove(paths);
    if (removeError) throw removeError;
    console.log(`\n  storage: removed ${paths.length} file(s) from the old tutor's folder.`);
  }

  // ── 6. Final verification. ───────────────────────────────────────────────
  const { data: finalUsers, error: finalError } = await admin
    .from("users")
    .select("username, email, role, full_name")
    .order("role");
  if (finalError) throw finalError;
  console.log(`\nDone. ${finalUsers.length} accounts remain:`);
  console.table(finalUsers);
}

main().catch((err) => {
  console.error("\ncleanup-users.mjs failed:", err);
  process.exit(1);
});
