# Build Progress

Tracks what's done, what's assumed, and what's deliberately deferred, phase by
phase. Phase numbers follow architecture §20.

## Phase 0 — Local Environment Setup & Project Initialization ✅ done

**Environment**
- Installed Node.js LTS (v24.19.0) and npm (11.17.0) via winget — neither was
  present on this machine beforehand.
- Confirmed Git is available (via Git Bash, v2.55.0).
- Docker was **not** installed — see decision below.

**Scaffolding**
- `apps/web`: Next.js 16 app, TypeScript, Tailwind CSS v4, ESLint, App Router,
  `src/` layout, `@/*` import alias.
- Route skeleton created per architecture §19: `/dashboard`, `/classes`,
  `/lessons`, `/teach/[lessonId]`, `/share/[lessonId]` — each a placeholder
  page stating which phase implements it. `/` links to the three top-level
  sections.
- `src/lib/supabaseClient.ts` — shared browser Supabase client, reads
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, fails loudly
  if unset.
- `src/lib/realtime.ts` — `HighlightState` type (matches architecture §7.2)
  and per-lesson channel naming helper, ready for the Highlighting + Realtime
  phase.
- `src/components/pdf/`, `src/components/dashboard/` — empty, reserved per §19.
- Installed `@supabase/supabase-js` and `pdfjs-dist` in `apps/web`.
- Root `package.json` holds the Supabase CLI as a devDependency (Supabase no
  longer supports a global npm install; a local devDependency + `npx supabase`
  is their supported path on Windows without Scoop).
- `supabase/` initialized (`supabase init`): `config.toml`, plus
  `migrations/0001_init_schema.sql` (verbatim schema from architecture §13,
  with RLS **enabled** — deny-by-default — on every table as a safe default
  ahead of the real policies, which land in the Phase 6 security pass).
- `supabase/functions/google-oauth-exchange/` and `drive-file-proxy/` created
  as explicit stubs (folders exist per §19, bodies are `501 not implemented`
  comments) — real implementation is Phase 2 (Drive integration), not before.

**Validated**
- `npm run lint` — clean.
- `npm run build` — compiles, type-checks (including the async `params`
  promise typing Next 16 requires for dynamic routes), and prerenders all
  static routes; dynamic routes (`teach/[lessonId]`, `share/[lessonId]`)
  correctly marked server-rendered-on-demand.
- `npm run dev` — started the dev server and curled every route
  (`/`, `/dashboard`, `/classes`, `/lessons`, `/teach/test-123`,
  `/share/test-123`); all returned `200` with no server errors in the log.

**Decisions / deviations** (see also README "Notable deviations")
- **App Router, not Pages Router.** Architecture §19's folder listing reads
  like Pages Router (`pages/teach/[lessonId].tsx`), but current
  `create-next-app` defaults to, and Next.js recommends, the App Router. Same
  `[lessonId]` dynamic-segment convention, no functional difference for this
  app. Confirmed with user before scaffolding.
- **Hosted Supabase project instead of local Docker stack.** `supabase start`
  needs Docker Desktop, which would mean installing Docker + WSL2 (likely a
  reboot) on this machine, and Docker Desktop's free tier has usage
  restrictions for larger organizations that were worth flagging given this
  machine's domain. Confirmed with user: develop directly against a hosted
  free-tier Supabase project instead. Functionally identical Postgres/Auth/
  Realtime/Storage APIs either way; the only loss is offline dev capability.
- **RLS enabled with no policies yet**, rather than leaving it off until
  Phase 6 as the dev-plan phasing implies. Because this is a hosted project
  reachable from the internet from the moment it's created (not a local-only
  Docker DB), leaving RLS off in the interim would mean anon-key holders could
  read/write every table. Enabling RLS now with zero policies makes every
  table inaccessible to the client until Phase 6 adds real policies —
  service-role (server-side) access is unaffected. Pure hardening, no
  scope change to Phase 6's actual work.

**Supabase project wired up** (2026-08-29)
- User created the hosted Supabase project (`pqlrexhtwgleokyiamie`) and
  provided the Project URL + a `sb_publishable_...` key. Note: this is
  Supabase's newer **publishable/secret key** format rather than the legacy
  `anon`/`service_role` JWTs the architecture doc predates — functionally a
  drop-in replacement for the anon key in `supabase-js`'s `createClient`, no
  code changes needed.
- `apps/web/.env.local` created (gitignored) with
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- User also provided a Supabase personal access token, used to
  `supabase link --project-ref pqlrexhtwgleokyiamie` and
  `supabase db push`. `0001_init_schema.sql` is now applied and recorded in
  the remote migration history (`supabase migration list --linked` shows
  `0001` local == remote).
- Verified end-to-end: `curl .../rest/v1/classes` with the publishable key
  returns `200 []` — confirms both connectivity and that the deny-by-default
  RLS posture is working (reachable, zero rows, no policy yet grants access).
  `npm run build` picks up `.env.local` and still compiles clean.

Phase 0 is now fully done, including the live backend — nothing outstanding
before Phase 1.

## Phase 1 — Core CRUD (classes, students, lessons, dashboard shell) ✅ done

Scope note: architecture §20 groups "Auth wiring" under the earlier
"Foundation" phase, but it's implemented here (start of Phase 1) since
role-scoped CRUD is meaningless without it — see README "Notable deviations".

**Database**
- `0002_auth_signup_trigger.sql` — `handle_new_user()` trigger (auth.users →
  public.users/tutors/students), since architecture §13's DDL doesn't wire
  Supabase Auth to the domain tables on its own.
- `0003_rls_policies_phase1.sql` — RLS policies for users/tutors/students/
  classes/class_members/lessons, plus `add_student_to_class(class_id, email)`
  — a narrow SECURITY DEFINER RPC so a tutor can add a student by email
  without a broad "read any student profile" policy (privacy, given §16's
  minors concern).
- `0004_fix_rls_recursion.sql` — **bug found and fixed during validation**:
  `classes` and `class_members` policies cross-referenced each other
  (`classes_student_select` queries `class_members`, `class_members_tutor_all`
  queries `classes`), which Postgres flagged as infinite RLS recursion
  (`42P17`) on every query against either table. Fixed with three
  `STABLE SECURITY DEFINER` helper functions (`is_tutor_of_class`,
  `is_member_of_class`, `is_tutor_of_student`) that break the cycle — the
  standard Supabase pattern for this. Same treatment applied to the
  users/students "tutor of student" policies, which had the same shape.
- Auth config: disabled email confirmation (`supabase config push`) — the
  hosted project defaulted to requiring it, and Supabase's free-tier shared
  SMTP allows only **2 emails/hour**, which made even manual signup testing
  hit a rate limit immediately. Documented tradeoff: signup email ownership
  is unverified for now; revisit alongside custom SMTP later. Also corrected
  `site_url`/`additional_redirect_urls` to `localhost:3000` (was defaulted to
  `127.0.0.1` with an `https://` typo from the dashboard's own default).

**Backend validated directly against the hosted project** (curl, before
touching the frontend): signup (tutor + student, via `auth.users` → trigger
→ `public.users`/`tutors`/`students`), self-select RLS, a second tutor's
cross-tenant isolation (empty results, RPC rejects with "Not authorized"),
class creation, `add_student_to_class` RPC, lesson creation, and student
read-visibility into their tutor's class/lesson — all confirmed working
after the recursion fix.

**Frontend** (`apps/web`)
- `src/lib/authContext.tsx` — `AuthProvider`/`useAuth`: tracks the Supabase
  session and the matching `public.users` profile row.
- `src/components/{Providers,NavBar,RequireAuth}.tsx` — app-wide auth wiring,
  role-aware nav, and a client-side route guard (redirects to `/login`; real
  enforcement is still RLS, this is only for UX).
- `/login`, `/signup` — email+password; signup role (Tutor/Student — Guardian
  deferred to Phase 2 per §4) is passed as `auth.users` metadata for the
  trigger to consume.
- `/classes` — tutor: create class, add/remove student by email, delete
  class. Student: read-only list, scoped automatically by RLS.
- `/lessons` — tutor: create lesson (linked to a class), change status,
  delete. Student: read-only.
- `/dashboard` — real queries for Today's/Upcoming/Recent lessons and My
  Classes (architecture §18); Active Lesson / Recently Used PDFs /
  Attendance Snapshot cards are explicitly marked "coming in a later phase"
  rather than faked.

**Validated**
- `npm run lint` / `npm run build` — clean (including a fix for a real
  issue: `React.FormEvent` no longer exists as of this React/Next version —
  `@types/react` flags it `@deprecated`, `SubmitEvent<HTMLFormElement>` is
  the correct current type for `onSubmit` handlers; and the new
  `react-hooks/set-state-in-effect` rule, satisfied by moving `setLoading`/
  `setError` calls after the first `await` rather than before it).
- Full end-to-end UI test via a throwaway Playwright script (driving the
  system's existing Chrome install headless — see below) against the real
  dev server and the real hosted Supabase project: tutor signs up → creates
  a class → student signs up → tutor adds student by email → tutor creates
  a lesson → lesson shows on the tutor's dashboard → student sees the class
  and lesson read-only with no mutation controls. **11/12 automated checks
  passed**; the one failure was the test checking the navbar before the
  async profile fetch resolved (a test-timing issue, not an app bug) — while
  investigating it, fixed a real minor UX flash (navbar briefly rendering
  "()" for name/role while the profile row loads).

**Outstanding / notes for the user**
- A `supabase_service_token` line appeared in `apps/web/.env.local` (not
  something this session added) — it's the same personal access token used
  for the CLI, not a service_role key, and nothing currently reads that
  variable. Flagged for the user rather than removed or acted on silently.
- Test accounts created against the live project during validation
  (`tutor.*`/`student.*`/`tutor2.*@qa-iqraspace.io`) are harmless but real
  rows in the hosted DB — delete them via Dashboard → Authentication → Users
  whenever convenient (needs the service_role key or dashboard access, which
  this session doesn't have).
- Recommend `/run-skill-generator` for the Playwright-driven UI check built
  for this phase's validation (chrome path, auth flow, dev-server gotchas) —
  Phases 3+ (Highlighting+Realtime, multi-browser sync) will want the same
  driving approach repeatedly.

## Phase 2 — PDF pipeline (upload to Storage, PDF.js viewer, page navigation)

Not started.

## Phase 3 — Highlighting + Realtime (highlight tool, Supabase Realtime, student sharing view)

Not started.

## Phase 4 — Meet + Attendance (manual Meet URL, manual attendance, lesson history/notes)

Not started.

## Phase 5 — Polish + Security pass (RLS policies, responsive/mobile, error states)

Not started.

## Phase 6 — Phase 2 kickoff (Google Drive OAuth + Picker, Calendar API auto-scheduling)

Not started.
