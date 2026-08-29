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

**Outstanding — needs the user**
- Create the actual Supabase project (dashboard sign-up + "New Project" is a
  user action; can't be done on their behalf) and hand back the Project URL +
  anon key so `apps/web/.env.local` can be filled in and the migration
  applied. Everything else in Phase 0 works without it — `npm run build` and
  `npm run dev` succeed today; Supabase-backed features simply throw the
  explicit "missing env var" error until then, rather than something more
  confusing later.

## Phase 1 — Core CRUD (classes, students, lessons, dashboard shell)

Not started.

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
