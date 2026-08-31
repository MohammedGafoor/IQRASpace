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
- `apps/learning`: Next.js 16 app, TypeScript, Tailwind CSS v4, ESLint, App Router,
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
- Installed `@supabase/supabase-js` and `pdfjs-dist` in `apps/learning`.
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
- `apps/learning/.env.local` created (gitignored) with
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

**Frontend** (`apps/learning`)
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
- A `supabase_service_token` line appeared in `apps/learning/.env.local` (not
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

## Phase 1 (expanded scope) — full demo parity + Islamic design system ✅ done (2026-08-29)

**Why:** the user supplied a static HTML file (`Quranic Teacher Solution -
Tutor Demo.html`) — an 18-screen demo of the complete product — and asked
that Phase 1 be brought to feature parity with it, with a real Islamic
visual identity, and nothing faked. Confirmed with the user up front: (a)
collapse architecture §20's Phases 2–5 into this pass rather than defer them,
and (b) drop 5 pitch-deck-only screens from the demo (Overview hero, "Why
This Solution?", Technical Overview, Roadmap, Feedback survey) — sales
narrative, not product. This entry supersedes the "Not started" phase
placeholders below; see also README "Notable deviations".

**Database** (`supabase/migrations/0005`–`0011`, all applied via `supabase db push` against the linked hosted project)
- `0005` — `lessons`: `start_time`, `duration_minutes`, `quran_surah_key`.
- `0006` — `lesson_notes`: structured `covered`/`performance_note`/`next_lesson_plan` fields.
- `0007` — `lesson_progress`: `recitation_score`/`tajweed_score`/`memorization_score` + `created_at`.
- `0008` — `tutors`: lesson-default and notification-preference columns.
- `0009` — new `notifications` table + `notify_user()` SECURITY DEFINER RPC
  (self-notify or tutor→own-student only, mirroring `add_student_to_class`'s pattern).
- `0010` — RLS policies for the 8 tables that had zero policies since Phase 0
  (`google_drive_files`, `lesson_materials`, `meetings`, `attendance`,
  `lesson_progress`, `lesson_notes`, `sharing_sessions`, `highlighted_content`),
  plus two new helper functions (`is_tutor_of_lesson`, `is_member_of_lesson`)
  extending 0004's recursion-safe pattern.
- `0011` — `lesson-materials` Storage bucket + RLS (tutor writes to their own
  `{tutorId}/` folder; read open to any authenticated user — documented
  tradeoff, these are lesson handouts, not personal data).

**Design system** — `apps/learning/src/app/globals.css` rewritten from the stock
create-next-app template to a full Islamic-inspired token set: warm ivory
paper, deep emerald/teal primary, warm gold accent, Fraunces (display) +
Inter (body) + Amiri (Qur'an Arabic) via `next/font/google`, a real
class-based dark mode (Tailwind v4 `@custom-variant`, persisted, not just
`prefers-color-scheme`), and a subtle geometric texture used sparingly. A new
`components/ui/` primitives library (Button, Card, Field/Input/Select/
Textarea, Badge, Modal, Toast, Avatar, ProgressBar, StatCard, Tabs,
EmptyState) replaces the ad hoc Tailwind-per-page pattern everywhere,
including the pre-existing login/signup/dashboard/classes/lessons pages.

**App shell** — new `(app)` route group (`components/shell/{Sidebar,Topbar,
AppShell,NotificationBell,ThemeToggle}.tsx`) provides a persistent, mobile-
collapsible sidebar + topbar (live notification bell, theme toggle, avatar)
wrapping `RequireAuth` once for every authenticated screen, replacing the old
per-page `<RequireAuth>` wrapper and flat `NavBar`. A `(public)` group keeps
`/`, `/login`, `/signup` on a slim public header. `/share/[lessonId]` stays
outside both groups — the student's live-follow view is deliberately
chrome-minimal per architecture §18.

**New screens, all real (Supabase-backed, not static arrays)**
- **Students** — directory aggregated from the tutor's classes/rosters, with a profile view (progress, attendance, recent notes).
- **Lesson Materials** — direct PDF upload to the new Storage bucket, list/preview/attach-to-lesson; a Google Drive tab with an honest "not configured" state (see exception below).
- **`components/pdf/PdfViewer.tsx`** — real `pdfjs-dist` wrapper (page nav, zoom) rendering Storage-hosted PDFs via signed URL.
- **Teach / Share** — the hero feature, fully rebuilt from one-line placeholders. A lesson opts into a bundled surah (`lib/quranContent.ts` — Al-Fatiha, Al-Ikhlas, Al-Falaq, An-Nas, Al-Asr, real Uthmani text); the tutor selects/highlights an ayah and shares it, which **broadcasts** live over the existing `lib/realtime.ts` `lesson:{id}` channel contract (`HighlightState`) and **persists** a `sharing_sessions`/`highlighted_content` row (architecture §16 audit trail). Realtime Presence drives live "connected student" indicators. A **catch-up query** (`lib/sharing.ts#getLatestHighlight`) seeds a student's view from the last persisted highlight on page load/reload, since Realtime broadcast has no replay — found and fixed during E2E validation (see below).
- **Google Meet** — manual `meet_url` per lesson (architecture §9 Option A, no OAuth), Join/Copy Link, a dedicated `/meet` screen.
- **Schedule** — real weekly grid from `lessons`, click-to-create modal.
- **Attendance** — mark present/absent/late/excused per student per lesson, weekly % stat.
- **Progress** — per-student skill-score trend (latest `lesson_progress` row) + a tutor-facing "add entry" form.
- **Lesson Notes** — CRUD against the new structured fields.
- **Notifications** — topbar bell + full screen, backed by real rows inserted via `notify_user()` at the moment of the triggering action (lesson scheduled, absence marked, note added) — not a push system, but genuinely real data.
- **Settings** — profile edit, real dark/light/system theme toggle, lesson defaults + notification prefs persisted to the new `tutors` columns, honest Google-connection status.

**The one deliberate exception:** Google Drive/Calendar OAuth needs a Google
Cloud project + client credentials only the project owner can provision.
Both Edge Functions (`google-oauth-exchange` — token exchange, AES-GCM
encrypt, store; `drive-file-proxy` — refresh + stream a Drive file's bytes)
are fully written to the same standard the rest of this pass holds to, and
the Materials page builds a real Google consent-screen redirect URL — but
**neither function has been deployed**, since there are no credentials to
exercise them against and deploying an untested OAuth surface isn't worth
the risk for a feature that can't be verified end-to-end here regardless.
Until a project owner runs `supabase functions deploy` and sets
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`/
`GOOGLE_TOKEN_ENCRYPTION_KEY` (see each function's header comment), the
Drive tab correctly shows "not configured" rather than a fake connection.
Direct PDF upload (above) is the fully-working materials path today.

**Validated**
- `npm run lint` / `npm run build` — clean.
- Full end-to-end validation via a throwaway Playwright script (system Chrome,
  same approach as Phase 1's original validation) against the real dev server
  and the live hosted Supabase project, **two separate browser contexts**
  (tutor + student): signup (both roles) → create class → add student by
  email → create a lesson (time, duration, Meet link, Qur'an surah) → upload
  a PDF material → open Teach → highlight + share an ayah → **student's
  `/share/[lessonId]` in a second, independent session sees the live
  highlight** → mark attendance → add a lesson note → tutor records a
  progress entry → student sees it on their own Progress page → student
  receives a real notification → dark mode persists across reload. Plus
  spot-checks of Students/Schedule/Meet/Settings. **21/21 checks passed** on
  the final run. Two real issues were found and fixed during this pass (not
  left as "probably fine"): the live-share catch-up gap above, and a set of
  `react-hooks/set-state-in-effect` lint errors from calling `setState`
  synchronously at the top of effects.
- Test accounts created during validation (`qa.*@qa-iqraspace.io`) are
  harmless but real rows in the hosted project — same note as Phase 1's
  original entry: delete via Dashboard → Authentication → Users whenever
  convenient.

## Phase 6 — Google Drive OAuth deployment, Calendar API auto-scheduling, Parent/Guardian role

Google Drive/Calendar OAuth code is written (see the exception above) but
not deployed — deploying it once real Google Cloud credentials exist is the
remaining work here, alongside Calendar API auto-scheduling (architecture §9
Option B) and the Parent/Guardian role (§4/§17). A security/responsive
polish pass (architecture §20's original Phase 5) is otherwise folded into
the expanded Phase 1 above rather than deferred.

## Real-content curriculum — Qaida – Beginners ✅ done (2026-08-29)

**Why:** the user supplied `docs/Noorani_Qaida.pdf` (39 pages) and asked for
a real, PDF-grounded beginner curriculum, wired into the actual app — not a
generic Qaida outline. Full curriculum (39 lessons + 12 review checkpoints +
1 final assessment, every field the user asked for, page references drawn
from actually reading the PDF): `docs/qaida-beginners-curriculum.md`.

**Database:** `0012_lesson_material_page_range.sql` — `lesson_materials`
gains `page_start`/`page_end`, since a lesson's attached PDF needs to open at
a *specific* range (e.g. Lesson 7 → page 7 only), not always page 1.

**Teach/Share — new PDF mode:** until now, `teach/[lessonId]` and
`share/[lessonId]` only understood the bundled-surah ayah-highlight flow
(`lib/quranContent.ts`). A lesson with no `quran_surah_key` but a real
attached PDF material now gets a second, real mode instead of the old
"no content attached" message: the tutor navigates the actual PDF
(`PdfViewer`, now supporting a controlled `page`/`onPageChange` pair) and
hits **Share This Page**, which broadcasts the page number over the same
`lesson:{id}` Realtime channel and persists it via `highlighted_content`
(`highlight_type: 'rect'`, generalized from the ayah-only version — see
`lib/sharing.ts`); the student's `/share/[lessonId]` renders the identical
PDF page, read-only, following live. This is page-level sync only — an
actual rectangle/word-level highlight *within* the page (the original
architecture §7's normalized-coordinate design) is not built; flagged
rather than silently implied.

**Seeded into the live project:** a dedicated demo tutor account
(`qaida.tutor@iqraspace.demo`) owns the real `Qaida – Beginners` class, the
real uploaded `Noorani_Qaida.pdf`, and all 52 real `lessons` rows (each with
a `lesson_materials` row carrying its correct page range) — reachable via
`Classes → Qaida – Beginners → Lessons → a lesson → Teach`. Seeded via a
throwaway Node script (`@supabase/supabase-js` against the hosted project),
not through slow UI automation.

**Validated:** `npm run lint` / `npm run build` clean. Playwright, two
independent sessions: tutor logs in → sees the class and all lessons →
opens Lesson 28 (the milestone "complete Surah Al-Fatiha" lesson) → the
real PDF renders at page 28 → shares it → **a separately-enrolled student,
in a second browser session, sees the identical PDF page render live** on
`/share/[lessonId]`. 10/11 checks passed — the one failure was a test-script
row-counting selector that raced the table's render (the very next
assertion, waiting properly, found the expected lesson title fine); not
a product defect.

## Lesson Material viewer — full-screen + annotation tools ✅ done (2026-08-29)

**Why:** the Materials preview (`PdfViewer`) was a cramped ~560px modal with
just Prev/Next and +/− zoom — the user asked for a real document-viewer
experience: full screen, drawing/annotation tools, undo/redo, zoom/fit/reset,
usable on mobile. Rebuilt `components/pdf/PdfViewer.tsx` in place (same
props/call sites — Materials preview, the Teach screen's tutor PDF panel,
and the student's read-only Share follower view all pick up the upgrade
automatically) rather than adding a second component.

**New:** `components/pdf/AnnotationLayer.tsx` (SVG overlay, coordinates
stored in page-space so annotations stay pixel-aligned at any zoom —
`viewBox` does the scaling, not app code) + `PdfToolbar.tsx` (compact,
collapsible). Tools: select/move, rectangle, ellipse, freehand, arrow,
highlight, underline, text, eraser; undo/redo (snapshot-stack); click an
annotation to select it (Delete button or Backspace/Delete key) or Clear
All. Full Screen is a CSS `fixed inset-0` overlay (not the native
Fullscreen API — more reliable across mobile browsers), exited via the
Exit button or Escape. Zoom In/Out, Fit to Screen, Reset, plus an
auto-shrink-to-fit on first load so a page wider than the container (e.g.
a phone screen) never starts oversized.

**Scope note, not silently assumed:** annotations are per-viewer-session
only (component state, reset when the viewer unmounts) — not persisted to
the database or broadcast to other viewers. The existing live highlight-sync
feature (Teach → Share) is a separate, already-real-time mechanism; drawn
annotations are a personal study/teaching aid on top of it, not part of it.

**Two real bugs found and fixed during this pass** (both would have hit
real users, not just the test):
1. The text-annotation tool: clicking created and focused the input, but
   without `preventDefault()` on the pointerdown, the browser's own default
   mousedown handling immediately blurred it again — discarding the draft
   before anyone could type. Fixed by calling `preventDefault()` in the
   layer's pointerdown handler.
2. Rapid zoom/page changes could call `pdf.js`'s `page.render()` a second
   time on the same canvas before the first finished, which pdf.js rejects.
   Fixed by tracking the in-flight `RenderTask` and calling `.cancel()`
   before starting a new one (and on unmount).

Also fixed, found via the same testing pass: a pre-existing ~23px mobile
horizontal-scroll bug in the app shell (unrelated to this feature, surfaced
by the same overflow check) — added `overflow-x: hidden` on `html`/`body`
as a standing safety net, plus `overflow-x-hidden` on the shared `Modal`
component (it only guarded vertical overflow before).

**Validated:** `npm run lint`/`build` clean. Three Playwright suites,
26/26 checks: desktop draw/undo/redo/zoom-alignment/fullscreen/page-nav;
text/select-delete/clear-all plus a 390px mobile-viewport pass (no
horizontal overflow, touch drawing works); and the Teach screen's tutor
toolbar + the Share screen's deliberately toolbar-free read-only view,
confirmed against a real second student session.

## Materials PDF viewer — pages 2+ render blank ✅ done (2026-08-29)

**Why:** reported against `docs/Holy-Quran-Para-1.pdf` (28 pages) as "only
the first page renders." That framing turned out to be imprecise in a way
worth recording: pagination itself was fine (Prev/Next moved, "Page X of Y"
updated correctly to 28) — what actually failed was the *content* of each
Quran page, which came back a blank white rectangle with only its vector
header/footer text ("www.Islamicnet.com", the footer line, the page number)
visible. Easy to misread as "stuck on page 1" since page 1 (a title/credit
page with no scanned image) is the one page that happens to render fully.

**Root-caused, not assumed:** an initial Node-side check (`pdfjs-dist`
parsing the file directly, enumerating all 28 pages via `getPage`) showed
every page as structurally valid, which just proved the file wasn't
corrupt — it said nothing about whether each page's content actually
paints. The real check was rendering to a canvas
(`page.render()` via `@napi-rs/canvas` in a throwaway Node script) and
inspecting the pixels, which reproduced the blank-body symptom outside the
browser entirely and surfaced the actual error pdf.js was swallowing:

```
Cannot find package 'nulljbig2_nowasm_fallback.js' imported from .../pdf.worker.mjs
getOperatorList - ignoring XObject: "Jbig2Error: JBig2 failed to initialize"
```

**Root cause:** these Quran pages are scanned Mushaf images compressed as
JBIG2 (standard for bilevel scanned text — small file size). `pdfjs-dist`
v6 moved its JBIG2/OpenJPEG image codecs to WASM modules that `getDocument()`
must be told where to find via a `wasmUrl` option (plus `standardFontDataUrl`
for non-embedded font fallback, `cMapUrl`/`cMapPacked` for embedded CID
fonts) — `PdfViewer.tsx` wasn't passing any of them. Without `wasmUrl`, pdf.js
can't even resolve its own pure-JS fallback decoder (hence the mangled
`null`-prefixed module specifier above) — so it doesn't error out, it just
**silently drops the image XObject** and moves on, leaving the page's vector
text (which doesn't depend on this codec) as the only visible content. No
exception reaches the app, no console error a user would notice — it just
looks like an empty page.

**Fix:**
- `scripts/copy-pdfjs-assets.mjs` — copies `wasm/`, `standard_fonts/`, and
  `cmaps/` from `node_modules/pdfjs-dist` into `public/pdfjs/` (git-ignored,
  version-stamped so it no-ops once already synced) so pdf.js's worker has a
  plain same-origin URL to fetch them from; the existing `workerSrc` trick
  (`new URL("pdfjs-dist/...", import.meta.url)`) only bundles a single named
  file, not a whole directory pdf.js requests from dynamically.
- Wired into `predev`/`prebuild` in `package.json` so it's always in sync
  with the installed `pdfjs-dist` version, no manual step.
- `PdfViewer.tsx`'s `getDocument()` call now passes `wasmUrl`,
  `standardFontDataUrl`, `cMapUrl`, `cMapPacked`.

**Validated:** re-ran the same Node canvas-render script with these options
set — `Holy-Quran-Para-1.pdf` pages 1, 2, and 5 all render completely
(full decorative border + Arabic Uthmani text, not just header/footer);
visually confirmed both a light page (2, Al-Fatiha) and a dense text page
(5, Al-Baqarah) render correctly. `npx tsc --noEmit` and `eslint` clean.

**Also fixed in the same pass:** requirement #4 ("direct navigation to a
specific page") wasn't built — Prev/Next and the read-only "Page X of Y"
label existed, but nothing let a user type a page number and jump. Added an
editable page-number field in place of the static number (tutor/uploader
views only — the Share follower stays plain text, since its page is driven
by the tutor's broadcast, not local input): free-typed text (so clearing the
field to retype doesn't fight a clamped `<input type=number>` on every
keystroke), commits on Enter/blur, clamps to `[1, numPages]`, disabled until
`numPages` is known.

## Materials PDF viewer — scroll-to-turn-page ✅ done (2026-08-29)

**Why:** requested as a document-reader UX on top of the existing single-page
viewer — scrolling down past the bottom of the current page should move to
the next page, scrolling up past the top should move to the previous page,
without the user reaching for the Prev/Next buttons.

**Implementation (`PdfViewer.tsx`):** a `wheel`/`touch*` listener pair on the
scrollable page container (native `addEventListener`, `passive: false`, not
React's synthetic `onWheel`/`onTouchMove` — needed so `preventDefault()`
reliably suppresses the native scroll/bounce for the one tick that instead
turns the page):
- **Wheel/trackpad:** `deltaY` sign + "already at that edge" (`scrollTop`/
  `scrollHeight`/`clientHeight`, 2px epsilon for subpixel rounding) decide
  whether to turn the page; anything short of the edge is left as an
  ordinary in-page scroll.
- **Touch:** has no `wheel` event, so the boundary drag is tracked by hand —
  distance from `touchstart` in the direction that, only at an edge, means
  "turn the page" (45px threshold) rather than an incidental overscroll
  bounce.
- **No multi-page skips from one gesture:** a 500ms lock starts the moment a
  scroll-triggered turn fires, so a trackpad fling or touch-momentum scroll
  that keeps generating boundary events can't cascade through several pages
  in one motion.
- **Opens at the right edge:** a forward turn (Next, or scroll-down) opens
  the new page scrolled to its top; a backward turn (Prev, or scroll-up)
  opens it scrolled to its bottom — mirroring how a continuous document
  flows. The new page's `scrollHeight` is read back **synchronously**
  (`pageWrapRef` is sized imperatively, not just via the `renderSize` state/
  style, so this doesn't race the next React commit) rather than guessed at.
- **Zoom is untouched:** the scroll handlers only ever change `pageNum`, never
  `scale` — the existing zoom/fit/reset controls are a completely separate
  piece of state.
- **Doesn't fight annotations:** scroll-turning only runs while the "select"
  tool is active. Without that guard, a touch drag while drawing a freehand/
  rect/arrow annotation on a page that already fits the viewport (so it's
  trivially "at both boundaries") would get misread as a page-turn swipe
  instead of a stroke — found by reasoning through the touch-event overlap
  with `AnnotationLayer`'s own pointer handlers before it shipped, not after.
  Read-only (Share follower) never scroll-turns at all — its page is driven
  by the tutor's broadcast, not local input.
- **Small transition:** a 150ms opacity dip/restore on the page while it
  (re)renders (page turns, zoom changes, and the initial page all pass
  through the same render effect) — subtle, not a loading state.

**Validated:** `npx tsc --noEmit` and `eslint` clean; confirmed the running
dev server still compiles the Materials route with no errors after each
edit. No browser-automation tool was available in this session to click/
scroll/touch the live UI directly — worth a manual pass through
`Holy-Quran-Para-1.pdf` (28 pages) end to end, particularly the page-1 and
page-28 edges (Prev/Next disabled + scroll-turn correctly refusing to go
past them) and a zoomed-in page (confirms in-page scrolling still happens
before the edge triggers a turn).

## Admin / Super Admin roles ✅ done (2026-08-30)

**Why:** the user asked for real Admin and Super Admin authentication,
reusing the existing role structure rather than a parallel permissions
system, with credentials configurable via `.env.local` and no hardcoded
secrets.

**Database** (`0017_admin_super_admin_roles.sql`, applied via `supabase db
push` against the linked hosted project) — extends `public.users.role`
(same column tutor/student/guardian already use) rather than adding a
separate table:
- `admin` — platform-wide **read-only** oversight (all users/classes/
  lessons). `super_admin` — everything `admin` has, plus the only role
  allowed to change another user's role.
- Two helper functions, same `STABLE SECURITY DEFINER` pattern as 0004/0010
  (`is_tutor_of_class` etc.): `is_admin()`, `is_super_admin()`.
- `public.set_user_role(user_id, new_role)` — the only sanctioned way to
  change a role; `security definer`, rejects the call outright unless
  `is_super_admin()`, and blocks a super_admin from demoting themselves.
- **Two pre-existing gaps closed in the same migration, not left for
  later** (adding 'admin'/'super_admin' to the CHECK constraint would have
  reopened both as real privilege-escalation paths):
  1. `handle_new_user()` (0002) trusted `raw_user_meta_data ->> 'role'`
     verbatim — now hard-whitelisted to tutor/student/guardian, so
     `supabase.auth.signUp()` can never mint an admin account no matter
     what metadata a caller sends (the signup UI never offered it, but
     nothing server-side previously stopped a direct API call).
  2. `users_update_own` (0003) was `using (id = auth.uid())` with no column
     restriction — any signed-in user could already run
     `update users set role = 'admin' where id = auth.uid()` against
     PostgREST directly. A new `before update` trigger
     (`prevent_role_self_escalation`) now blocks any change to `role`
     unless it goes through `set_user_role()` or the caller is
     `service_role` (the seed script below).
- `users_select_as_admin` / `classes_select_as_admin` /
  `lessons_select_as_admin` — read-only visibility for `is_admin()`.

**Provisioning — no admin account is reachable via public signup, by
design:** `apps/learning/scripts/seed-admin-accounts.mjs` (`npm run seed:admins`)
reads `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`SUPER_ADMIN_EMAIL`/
`SUPER_ADMIN_PASSWORD` + `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` and
creates/promotes those two accounts directly via the Auth Admin API —
idempotent (safe to re-run after editing `.env.local`).

**Frontend** (`apps/learning`): `Role` type extended (`src/lib/types.ts`);
`src/lib/roles.ts` centralizes the admin/super_admin check used everywhere
(Sidebar, layout redirect, both admin pages) rather than repeating
`role === "admin" || role === "super_admin"`. New `(app)/admin` route
group: `/admin` (platform stat cards: tutors/students/guardians/classes/
lessons) and `/admin/users` (every account, role badges; the role-change
dropdown + Save only renders for `super_admin` — `set_user_role()` rejects
the RPC server-side either way if a plain admin's request reached it
regardless). Admin/super_admin get a dedicated, smaller sidebar
(`ADMIN_NAV_ITEMS` in `navConfig.ts`) instead of the tutor nav, and are
redirected from `/dashboard` etc. to `/admin` (UX only — `RequireAuth
allow={ADMIN_ROLES}` and RLS are the real enforcement); `/login` routes
admin/super_admin straight to `/admin`.

**Validated** directly against the hosted project (throwaway Node script,
`@supabase/supabase-js`, cleaned up after): signed in as the seeded Admin,
Super Admin, and a fresh disposable tutor account, then, per role, checked
exactly what the task asked for — **12/12 checks passed**:
Admin reads the full `users`/`classes` tables (oversight); Super Admin does
too, promotes the disposable tutor to `admin` via `set_user_role()`
(confirmed in the DB), demotes it back, and is refused when demoting
*itself* away from `super_admin`; the regular tutor's own `users` query is
still RLS-scoped to itself (1 row, not the whole table), its `set_user_role()`
call is rejected, its direct `update users set role=...` self-escalation
attempt is rejected by the trigger (role unchanged afterward), and a plain
`admin` (not `super_admin`) is refused by `set_user_role()` too. `npm run
lint` / `npm run build` clean.

**Real bug found and fixed right after, not left as "probably fine":** both
seeded passwords originally used `#` (`IqraAdmin#2026`,
`IqraSuperAdmin#2026`) and logins failed with "Invalid login credentials"
even though the file looked correct. Root cause: `npm run seed:admins` runs
via `node --env-file=.env.local`, and Node's `--env-file` parser truncates
an unquoted value at `#` mid-line — `ADMIN_PASSWORD=IqraAdmin#2026` was
silently read as just `IqraAdmin`, so the real account password never
matched what was visibly in the file. Fixed by changing the default
passwords to avoid `#`/`$` entirely, documenting the gotcha prominently in
both `.env.local` and `.env.local.example` (quote the value if you do want
one:`ADMIN_PASSWORD="...#..."`), and adding a check to
`seed-admin-accounts.mjs` that re-reads the raw file and fails loudly with
the same explanation if it ever sees an unquoted `#` in either password,
instead of silently provisioning a truncated one.

## Admin full-access (Phase 2) ✅ done (2026-08-30)

**Why:** the user asked for Admin to have full CRUD/management access across
the entire app for this startup phase — not just the read-only oversight
the previous phase shipped — while explicitly avoiding a granular
permission system for now (reuse `is_admin()` everywhere, keep it simple,
leave room to tighten later). Super Admin keeps the same access as Admin;
they aren't differentiated yet.

**Database** (`0018_admin_full_access.sql`, applied via `supabase db push`):
- `is_admin()`-gated `FOR ALL USING (...) WITH CHECK (...)` policies added
  to every table that had none: `students`, `tutors`, `class_members`,
  `lesson_materials`, `google_drive_files`, `meetings`, `attendance`,
  `lesson_progress`, `lesson_notes`, `sharing_sessions`,
  `highlighted_content`, `lesson_plans`, `lesson_plan_items`,
  `class_lesson_plans`, `student_lesson_progress`,
  `student_lesson_completions`. The three `0017` SELECT-only admin policies
  on `users`/`classes`/`lessons` were dropped and replaced with `FOR ALL`
  equivalents.
- Three admin bypass policies on `storage.objects` for the
  `lesson-materials` bucket (insert/update/delete — read was already open to
  any authenticated user per `0011`).
- `add_student_to_class()` and `notify_user()` each had their own internal
  `auth.uid()`-based authorization check, independent of RLS — both widened
  with an `is_admin()` escape hatch, otherwise an admin still hit "Not
  authorized" inside them even with every table policy fixed.
- `set_user_role()` relaxed from `is_super_admin()` to `is_admin()` — every
  other write path added in this migration is `is_admin()`-gated, so keeping
  role changes as a `super_admin`-only carve-out would have contradicted
  "Admin = full access" without materially reducing risk. The self-lockout
  guard widened from "can't remove your own `super_admin`" to "can't remove
  your own admin-level access," so a plain admin can't strip their own
  access either (a `super_admin` *can* still demote itself to plain `admin`
  — still admin-level, not a lockout). `is_super_admin()` itself is
  untouched, unused for now, ready for a future finer split.

**New Edge Function** (`supabase/functions/admin-user-management/index.ts`,
deployed via `supabase functions deploy`) — the task asked for admin to
create/deactivate/delete users and reset passwords, all of which need
`auth.admin.*` (the `service_role` key), which must never reach the
browser. Follows the exact pattern `google-oauth-exchange`/
`drive-file-proxy` already established (verify the caller's own session
token server-side, re-check their role against the DB — never trust a
client-sent role). One function, one `action` discriminator (`create`,
`reset_password`, `deactivate`, `reactivate`, `delete`). `create` only
allows `tutor`/`student`/`guardian` — `admin`/`super_admin` stay exclusively
on `npm run seed:admins`, preserving the boundary `0017` already drew.
Deactivate/reactivate uses Auth's native ban (`ban_duration`) rather than a
new `active` column. A caller can't deactivate/delete their own account.

**Frontend** (`apps/learning`):
- `(app)/layout.tsx`'s `AdminRedirect` removed outright — it was bouncing
  admin off every route except `/admin/*` and `/settings`, which directly
  contradicted "admin manages everything." Admin now reaches the full nav.
- Every tutor-facing page (`students`, `classes`, `lessons` — the Lesson
  Library / Universal Lesson Plan screen — `progress`, `materials`,
  `schedule`, `attendance`, `notes`, `teach/[lessonId]`, `dashboard`) swaps
  its `isTutor`-only CRUD gate for `canManage = isTutor ||
  isAdminRole(profile?.role)`, and where a query explicitly filtered
  `.eq("tutor_id", profile.id)`, that filter is now conditional on `isTutor`
  specifically so admin gets the all-tutors view instead.
- New `components/admin/TutorPicker.tsx` — admin has no `tutors` row of its
  own, so `classes.tutor_id`/`lesson_plans.tutor_id` (both `NOT NULL
  REFERENCES tutors(id)`) need an explicit "acting on behalf of" choice when
  admin creates a class or a lesson plan. `CreateLessonForm`'s lesson insert
  needed no new UI — `tutor_id` is now derived from the selected class
  (`classes.find(...)?.tutor_id`) rather than the caller, which is strictly
  more correct for a tutor too.
- `lib/storage.ts` gained `listAllLessonMaterials()` — the Materials page's
  storage list was always scoped to the caller's own bucket folder; admin
  needs every tutor's folder enumerated and flattened (bucket read was
  already open to any authenticated user per `0011`, so no RLS change was
  needed for the read side, only §above's write policies).
- `admin/users/page.tsx` gained a "Create user" form and per-row Reset
  Password / Deactivate / Reactivate / Delete actions, all calling the new
  Edge Function; `canChangeRoles` now checks `isAdminRole` instead of
  `isSuperAdminRole` to match the relaxed RPC. `navConfig.ts`'s
  `ADMIN_NAV_ITEMS` is now the 2 admin-only items followed by the full
  tutor `NAV_ITEMS`, replacing the old 3-item curated list.
- No new "Application Settings" subsystem — no such table/concept existed,
  and the task's ask maps cleanly onto `/settings`'s already-ungated Profile
  card. Inventing a global-config table now would have been over-engineering
  the task explicitly warned against.

**Validated** directly against the hosted project: `npx tsc --noEmit`,
`eslint`, and `npm run build` clean. A throwaway Node script
(`@supabase/supabase-js`-equivalent raw REST/RPC calls) created fully
disposable test tutor/student accounts via the Edge Function, exercised
every layer, and cleaned up after itself — **37/37 checks passed**: admin
can `SELECT` all 15 previously-blocked tables; admin sees and can `UPDATE` a
class it doesn't own; a regular tutor's `classes` query is still scoped to
its own `tutor_id` and its `set_user_role()` call is still rejected
(regression check); `add_student_to_class()`/`notify_user()` no longer
reject an admin caller; a plain `admin` (not just `super_admin`) can call
`set_user_role()`; the Edge Function refuses to create an admin/super_admin
account and refuses to deactivate the caller's own account; `set_user_role`
refuses to let admin/super_admin remove their own admin-level access, but
lets `super_admin` step down to plain `admin`; the full create → reset
password → deactivate → reactivate → delete lifecycle succeeds and cascades
correctly. No browser-automation tool was available in this session — worth
a manual click-through as a final sanity pass (see "Remaining gaps" below).

**Remaining gaps for a future hardening phase (documented, not fixed here,
per the task's own "don't over-engineer" instruction):**
- `is_super_admin()` is defined but currently unused — the intended seam for
  differentiating Admin vs Super Admin once the app needs it.
- `users`/`classes`/`lessons`/etc. now grant `is_admin()` blanket `INSERT`/
  `UPDATE`/`DELETE` via `FOR ALL`, rather than funneling specific admin
  actions through narrower, purpose-built policies or RPCs (e.g. `users`
  gained a direct-`INSERT` capability admin has no current UI path to use,
  since user creation goes through the Edge Function instead).
  Same-flavor tables might later warrant a narrower default deny + specific
  permissive policies, but per this phase's scope, `FOR ALL USING
  (is_admin())` was decided to be enough.
- `LessonPlanItemForm`'s material picker still only browses the *acting*
  user's own storage folder — an admin editing another tutor's plan item
  can't browse that tutor's already-uploaded files, only upload a fresh one.
  Minor UX gap, not a permissions gap (admin can already write into any
  tutor's folder per this migration's storage policies).
- No UI surfaces `auth.users.banned_until` from the server — the
  Deactivated badge on `/admin/users` is a session-local, optimistic
  reflection of the last action taken, not fetched on page load.
  (**Superseded** by Phase 3 below, which adds a real `"status"` action.)

## Username-based auth + user cleanup (Phase 3) ✅ done (2026-08-30)

**Why:** the user asked for two things together: (1) trim the 27
accumulated QA/manual-testing accounts down to exactly 4 — 1 super_admin, 1
admin, 1 tutor, 1 student — and (2) make email optional everywhere, logging
in by username + password instead.

**Live-DB decision, not guessed:** inventorying the hosted project surfaced
two conflicting "Qaida" tutor accounts — `qaida.tutor@iqraspace.demo` (the
originally documented demo account, owned the actual uploaded PDF but only
a 1-item stub lesson plan) vs `shaheen@iqraspace.com` (held the complete
real 52-lesson curriculum + a "Quran" class, referencing that PDF by path).
Asked the user which to keep — **chose Shaheen.** No student account had any
real progress/attendance data to prefer one over another, so one was
repurposed as a generic "Demo Student" and enrolled into Shaheen's class.

**Database** (`0019_username_auth.sql`, `0020_fix_lessons_tutor_cascade.sql`):
- `users` gains `username` (`NOT NULL UNIQUE`), `auth_email` (`NOT NULL` —
  mirrors whichever email Supabase Auth actually has on file, real or
  synthetic), and `phone` (nullable). `email` loses its `NOT NULL` (stays
  `UNIQUE`) — now a purely optional contact field, unrelated to how the
  account authenticates.
- `handle_new_user()` now requires `username` in signup metadata (raises if
  missing) and splits `new.email` (the real Auth identifier, into
  `auth_email`) from `raw_user_meta_data ->> 'contact_email'` (into the
  now-optional `email`).
- New `get_auth_email_for_username(username)` — `STABLE SECURITY DEFINER`,
  granted to **`anon`** (the first anon-callable function in this project —
  every other helper is `authenticated`-only, since this one specifically
  has to run *before* a session exists). Returns only `auth_email`, never
  the full profile, so the login flow can resolve a username to something
  `signInWithPassword` accepts without ever exposing which usernames exist
  beyond a null/non-null response.
- `add_student_to_class(class_id, email)` → `add_student_to_class(class_id,
  username)` — a student may now have no email at all, so enrollment moved
  to the identifier that's actually guaranteed to exist. Had to be dropped
  and recreated rather than `CREATE OR REPLACE`d (Postgres rejects renaming
  a function's input parameter in place).
- **Real bug found while writing the cleanup script, fixed immediately**:
  `lessons.tutor_id -> tutors(id)` was missing `ON DELETE CASCADE` (the only
  one of four `tutor_id` FKs across the schema without it — classes/
  lesson_plans/google_drive_files all had it correctly since 0001/0013).
  Deleting any tutor who'd ever taught a lesson failed with a raw FK
  violation — this would have broken `admin-user-management`'s `delete`
  action for exactly that case, not just the cleanup script. Fixed in
  `0020_fix_lessons_tutor_cascade.sql`.

**One-off script** (`apps/learning/scripts/cleanup-users.mjs`, run once against
the hosted project, not meant to be re-run routinely): moved
`Noorani_Qaida.pdf` (+ an unrelated leftover `Holy-Quran-Para-1.pdf` test
file) from the old demo tutor's Storage folder to Shaheen's, re-pointed all
52 `lesson_plan_items.material_storage_path` values to match, enrolled the
kept student into Shaheen's class, set clean usernames (`admin`,
`superadmin`, `shaheen`, `student`) on the 4 survivors, then deleted the
other 23 accounts (`public.users` row first — cascades everything
downstream — then the matching Auth user, same order as
`admin-user-management`'s `delete` action).

**Edge Function** (`admin-user-management`): `create` now takes `username`
(required) + optional `email`/`phone` instead of requiring `email`; builds
the real Auth email as the contact email if given, else
`<username>@users.iqraspace.internal`. New `"status"` action
(`auth.admin.getUserById` → `{ banned }`) replaces the old session-local
guess at Active/Deactivated state.

**Frontend**: `AppUser.email`/`phone` are now `string | null`; `username:
string` added. New `lib/username.ts` (`buildAuthEmail`, `friendlyAuthError`
— maps a `users_username_key` violation to "That username is already
taken."). Login page: username input, resolves via
`get_auth_email_for_username` before `signInWithPassword`, generic "Invalid
username or password" either way (no enumeration signal). Signup page:
username required, email now explicitly optional. `classes/page.tsx`'s
"Add student by email" → "Add student by username". `admin/users/page.tsx`
gained a Username column, a Phone field on Create, and a full Edit modal per
row (Username/Name/Phone/Email/Role/real Status/Reset-Password/Deactivate/
Delete) — matching the "Tutor Information" shape asked for, generically for
any role. `seed-admin-accounts.mjs` now also sets `username: "admin"` /
`"superadmin"`.

**Validated**: `tsc`/`eslint`/`build` clean. A script-level check (22/22
passed) confirmed: exactly 4 accounts remain, 1 per role; all 4 log in by
username; Shaheen's 52-item curriculum and its re-pointed material paths
survived intact; a brand-new signup with username+password and **no email**
succeeds and can log back in; a duplicate username is rejected; admin can
create a tutor with no email via the Edge Function, edit its profile fields
directly (`users_all_as_admin`, 0018), reset its password, and that tutor
can then log in by username with the new password; an unknown username
resolves to `null` rather than an error. A live Playwright pass against the
running dev server confirmed the actual login form (typing only a username,
no email anywhere) lands on `/admin`, and the Manage Users Edit modal
renders exactly the requested fields for Shaheen's tutor record.

## Universal Lesson Plans — removed Tutor ownership (Phase 4) ✅ done (2026-08-30)

**Why:** `lesson_plans.tutor_id NOT NULL REFERENCES tutors(id)` made every
curriculum belong to exactly one tutor — architecturally wrong per the
user's model, where a Lesson Plan is a shared, reusable curriculum (e.g.
"Qaida – Beginners") any number of tutors browse and assign to their own
classes, while each student's position in it stays personalized. This
column was also why Phase 2 needed the `TutorPicker` workaround for lesson
plans specifically (an admin has no `tutors` row of its own).

**Confirmed before touching anything**: the rest of the model already
matched the requested design — `class_lesson_plans` links a (tutor-owned)
class to a plan with no tutor check on the plan side; `student_lesson_progress`/
`student_lesson_completions` are keyed by `student_id` + `lesson_plan_id`
(gated by `is_tutor_of_student()`, not plan ownership). The *only* violation
was `lesson_plans.tutor_id` itself, its RLS policy, and the two frontend
files assuming a plan has an owning tutor.

**Confirmed with the user**: curriculum editing (create/edit/reorder/
delete a plan or its items) is now **admin/super_admin only**, matching the
"Lesson Library / Curriculum" full-CRUD requirement from the original Admin
full-access request. Any tutor still gets full read access to browse the
whole catalog and can assign their own classes to any plan.

**Database** (`0021_universal_lesson_plans.sql`): dropped
`lesson_plans_tutor_all` / `lesson_plan_items_tutor_all` and their
`is_tutor_of_lesson_plan()` / `is_tutor_of_lesson_plan_item()` helpers
(the column-referencing policy has to go before the column itself), then
`ALTER TABLE lesson_plans DROP COLUMN tutor_id`. Added `is_any_tutor()`
(same `STABLE SECURITY DEFINER` convention as `is_admin()`) plus
`lesson_plans_select_for_tutors` / `lesson_plan_items_select_for_tutors` —
read-only, catalog-wide, for any tutor. `lesson_plans_all_as_admin` (0018)
and `lesson_plans_student_select`/`is_plan_visible_to_student` needed no
change — neither referenced `tutor_id`. `class_lesson_plans` needed no
change either — `class_lesson_plans_tutor_all` already checked only
`is_tutor_of_class(class_id)`, with no plan-ownership condition.

**Frontend**: `LessonPlan` type loses `tutor_id`. `LessonPlanPicker`
(`components/lessons/`) drops its `tutorId` prop (the "New Plan" insert no
longer sets one) and gains a `canCreate` prop gating the "+ New Plan"
affordance. `LessonPlanItemForm`'s `tutorId` prop renamed to `uploaderId`
(pure rename — it was always just "whose Storage folder to upload into,"
unrelated to plan ownership). `lessons/page.tsx` (the Lesson Library)
splits its old single `canManage` flag into `canEditCurriculum` (admin-only
— gates New Plan/Add Lesson/Edit/Reorder/Deactivate) and
`canAssignClasses` (tutor-or-admin — keeps the "Used by / Assign a class"
control and "Preview sequence" available to any tutor); removed the
`TutorPicker`/`actingTutorId` machinery entirely (`TutorPicker` itself
stays, still used by `classes/page.tsx` for the still-legitimate
`classes.tutor_id`).

**Validated**: `tsc`/`eslint`/`build` clean. A script-level check (27/27
passed) did exactly what the task asked — created two fully disposable
tutors and two disposable students, confirmed both tutors can read the same
real 52-item curriculum, confirmed a plain tutor is rejected from
inserting/updating `lesson_plans`/`lesson_plan_items` while admin succeeds,
had each tutor independently create their own class and assign it to the
*same* shared plan, enrolled one student per class, and confirmed each
student's `student_lesson_progress` row against that shared plan moves
independently (student A at item 3, student B at item 1, neither affecting
the other) — plus a regression check that tutor B still can't see tutor A's
class or alter student A's progress. A live Playwright pass logged in as
the surviving tutor and as admin: the tutor's Lessons screen shows "The
shared curriculum" with no New Plan/Add Lesson/Edit/Reorder controls (only
Preview sequence + Assign a class), while admin's shows "The shared lesson
library" with full edit controls — confirmed by both screenshot and a DOM
button-presence check.

**Incidental find**: the live DB showed the surviving tutor/student
accounts had already been renamed to `Shaanu`/`Std001` via the Admin ->
Manage Users Edit modal shipped in Phase 3 — real-world confirmation that
feature works, seen independently of this session's own tests.

## Student Progress, Lesson Assignment & Direct Lesson Access ⏳ code done, migration not yet pushed (2026-08-30)

**Why:** Tutors/Admins had no direct way to manage a student's position in
their curriculum. The only form near curriculum data on Student Progress
("Add Progress Entry") is actually `lesson_progress` — a skill-score
journal FK'd to the scheduled-session `lessons` table — not the curriculum
system, so its dropdown showed "No lessons yet" even with a full 52-item
Qaida plan, because no session had been scheduled. The real "current
lesson" (`student_lesson_progress.current_item_id`, 0013/0014) had no
management UI at all outside the live Teach screen's completion checklist.

**Two real DB gaps found and fixed** (`0022_student_progress_gaps.sql`,
**not yet applied to the hosted project — no `supabase` CLI in this
session's environment; run `supabase db push` and validate before relying
on this**):
1. A class assigned to a plan only seeded `student_lesson_progress` for
   students enrolled *at that moment* (`assignClass()`'s client-side loop
   in `lessons/page.tsx`) — a student added afterward via
   `add_student_to_class()` (0019) got no curriculum row at all. Replaced
   with two `SECURITY DEFINER` triggers, `seed_progress_on_plan_assigned`
   (on `class_lesson_plans` insert) and `seed_progress_on_member_added` (on
   `class_members` insert), both calling a shared
   `seed_student_lesson_progress()` function — seeding now happens
   consistently regardless of which path adds the row. The now-redundant
   client-side loop was removed from `assignClass()`.
2. `student_lesson_completions.confirmed_by` was FK'd to `tutors(id)`, but
   `seed-admin-accounts.mjs` deliberately gives admin/super_admin accounts
   no `tutors` row — so an admin confirming a lesson completion (via the
   existing Teach-screen modal, gated `canManage = isTutor || isAdminRole`
   everywhere) would hit an FK violation. Re-pointed the constraint at
   `users(id)` instead, which every tutor row already is.

**New shared data layer** (`lib/curriculum.ts`): `getStudentClassCurriculum()`
is the single correct join — Class → `class_lesson_plans` → Plan → active
Items → this student's `student_lesson_progress`/`student_lesson_completions`
— every screen now reads from. `getStudentCurriculumProgress()` (existing,
used for the compact multi-plan summary bars) now filters to only plans
currently assigned to one of the student's *current* classes, so a stale
row from a since-reassigned class no longer leaks through. Added
`getBulkCurrentLessonItems()` (one batched round trip for the Students
grid) and mutations that touch only `student_lesson_progress`/
`student_lesson_completions` — never the Universal Lesson Plan itself:
`setStudentCurrentItem` (change/repeat/skip), `confirmStudentLessonCompleted`
(mark complete + advance, `lesson_id` optional — no scheduled session
required), `updateStudentProgressNotes`, `assignStudentStartingLesson`
(legacy-data catch-up). `ConfirmLessonCompletionModal` was refactored to
call `confirmStudentLessonCompleted` instead of duplicating the upsert
logic, so there's exactly one "advance a student" code path.

**New component** `components/students/StudentLessonManager.tsx`: per
class/plan, shows the student's current lesson, a Launch-Lesson button, a
completed-lessons list, and (when `canManage`) a dropdown to jump to any
active lesson plus a "Mark Completed & Advance" button and a notes field.
`components/students/LessonMaterialViewer.tsx` (`useLessonMaterialViewer()`)
opens a lesson's material standalone — signed-URL PDF via the existing
`PdfViewer`, or a small info panel for a Qur'an-surah item with no PDF —
reusing the exact pattern `lessons/page.tsx`'s own `openMaterial()` already
used, shared between the Students grid and the new manager.

**UI**: Students page — each card gets "▶ Launch Lesson" (opens the
student's current item's material directly) or "＋ Assign Lesson" (opens
the detail modal) depending on whether they have a current item yet; the
detail modal embeds `StudentLessonManager`. Progress page — the read-only
"Lesson Plan Progress" card is replaced with `StudentLessonManager` in
manage mode; the skill-score card is relabeled "Skill Score Entry" with a
proper empty state + link to `/schedule` instead of a bare disabled
dropdown when the student's class has no scheduled sessions yet, and its
lesson list is now scoped to the *selected* student's own classes (it
previously showed every lesson across all of the tutor's classes).

**Validated**: `tsc --noEmit` and `eslint` clean across every touched file.
**Update**: `0022` was pushed in a follow-up (`npx supabase link` +
`npx supabase db push` — no CLI preinstalled in this environment, so it's
invoked via `npx` each time) after the admin FK violation
(`student_lesson_completions_confirmed_by_fkey`) actually surfaced live
against the seeded demo student, confirming the fix; `supabase migration
list --linked` shows `0022` applied remotely. Still not independently
re-verified: the seeding triggers themselves (a class assignment / a
student added afterward) — do that pass before relying on it further.

## Student-Based One-to-One Scheduling ✅ done (2026-08-30)

**Why:** Scheduling was class-based — `lessons.class_id` was the required
anchor, `CreateLessonForm` booked "when a tutor meets a class," and Teach/
Attendance pulled their whole roster from `class_members`. But this app is
one-to-one: a class can hold several students (confirmed live: one class
had 5 members), each progressing independently, so a session is really
"tutor meets *this* student," not "tutor meets the class." There was no way
to book a session for one specific student, no configurable 20-minute
default, and no recurring-session support.

**Database** (`0023_student_based_scheduling.sql`, pushed and verified
live): `lessons` gets a required `student_id UUID REFERENCES students(id)`
(confirmed 0 existing rows before the migration, so added `NOT NULL`
directly, no backfill) + an index. `class_id`/`tutor_id` deliberately stay
on `lessons` unchanged, still required, still auto-derived client-side from
the chosen student — every existing RLS policy and every table FK'd to
`lessons(id)` (attendance, lesson_materials, meetings, lesson_notes,
lesson_progress) needed zero changes. New table `recurring_session_rules`
(tutor_id, student_id, class_id, days_of_week int[], start_time,
duration_minutes, active, starts_on, ends_on, same
`is_tutor_of_class()`-gated RLS convention as every other class-scoped
table) + `lessons.recurring_rule_id` for traceability. `tutors
.default_lesson_duration_minutes` default changed 45 -> 20 (the one-to-one
standard), with existing rows still at the untouched factory default (45)
bumped too — confirmed live the one existing tutor was already customized
to 30 and was correctly left alone.

**No cron/background jobs**: recurring sessions are generated as a fixed
batch up front (`lib/recurringSessions.ts`'s `generateSessionsForRule()`,
~8 weeks, idempotent — skips any date the student already has a session
on), not materialized lazily. A "Generate 8 more weeks" button on
`/schedule`'s new Recurring Sessions card re-runs it to top up further, and
a rule can be paused (`active` toggle) — there's no automatic ongoing
generation beyond that action.

**Frontend**: `CreateLessonForm.tsx` replaced by
`components/lessons/ScheduleSessionForm.tsx` — Student is the primary
picker (via new `lib/roster.ts`'s `getManagedStudentRoster()`, factored out
of the `classes -> class_members -> users` join already duplicated
elsewhere); class/tutor auto-derive from the selected student; the current
lesson is a **read-only** reference (`getStudentClassCurriculum()`, already
built) — never chosen here. One-time vs. Recurring toggle; duration
defaults to the tutor's own setting; end time computed via new
`lib/format.ts` helpers (`addMinutesToTime`/`computeEndTime`). `/schedule`
gained a "Today's Sessions" list (time range, student, current-lesson
reference, Launch Lesson via the already-built
`useLessonMaterialViewer()`, Start Session) above the existing 7-day grid
(now showing student names instead of class names), plus the Recurring
Sessions management card described above. `TeachClient.tsx` and
`attendance/page.tsx` switched from loading the whole class roster
(`class_members`) to just the session's one `student_id`. Also fixed for
consistency while touching these flows: `notes/page.tsx`'s notify-on-note
loop was notifying every student in the class instead of just the session's
one student (same class-roster assumption as the pre-refactor scheduling
code); several lesson pickers (`notes`, `attendance`, `materials`, `meet`)
labeled sessions by `title` alone, which is now frequently just the generic
default "Session" — all four now show the student's name instead.

**Validated**: `tsc --noEmit` and `eslint` clean across every touched file.
Migration pushed and verified live (`lessons.student_id`/`recurring_rule_id`
columns and `recurring_session_rules` table all reachable;
`default_lesson_duration_minutes` update correctly left the one customized
tutor row at 30, untouched). **Not yet independently tested end-to-end in
the running app**: scheduling a one-time session for a specific student,
creating a recurring rule and confirming ~8 weeks of sessions generate
correctly, and Launch Lesson from Today's Sessions opening the right
material — do a manual pass through `/schedule` before relying on this.
