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

**Design system** — `apps/web/src/app/globals.css` rewritten from the stock
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
