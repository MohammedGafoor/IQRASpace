# IQRASpace — Quranic Teacher

Online Quran learning management for a solo tutor and their students. Full
architecture, requirements, and rationale live in
[`Iqra-space-architecture.md`](./Iqra-space-architecture.md) — read that first.

Build status and phase-by-phase notes: [`docs/PROGRESS.md`](./docs/PROGRESS.md).

## Stack

- **Frontend:** Next.js 16 (App Router, TypeScript, Tailwind CSS) — `apps/learning`
- **Backend:** Supabase (hosted free tier) — Postgres, Auth, Realtime, Storage, Edge Functions
- **PDF rendering:** PDF.js (client-side)
- **Hosting (planned):** Cloudflare Pages

## Prerequisites

- Node.js 20+ and npm (this repo was set up with Node 24)
- A free [Supabase](https://supabase.com) account + project (see below) — no Docker required, we develop against a hosted project rather than the local Supabase Docker stack

## First-time setup

1. **Install dependencies:**
   ```bash
   npm install               # root — installs the Supabase CLI (devDependency)
   npm install --prefix apps/learning
   ```

2. **Create a Supabase project:**
   - Go to https://supabase.com/dashboard → New Project (free tier, no card required).
   - Once it's provisioned, go to **Project Settings → API** and copy the **Project URL** and **anon public key**.

3. **Configure the frontend env:**
   ```bash
   cp apps/learning/.env.local.example apps/learning/.env.local
   # then edit apps/learning/.env.local with the URL + anon key from step 2
   ```

4. **Apply the database schema:**
   ```bash
   npx supabase login                       # opens a browser to authenticate the CLI
   npx supabase link --project-ref <your-project-ref>   # ref is the subdomain in your project URL
   npx supabase db push                     # applies supabase/migrations/*.sql
   ```
   (Alternative: paste the contents of `supabase/migrations/0001_init_schema.sql` into the Supabase SQL Editor and run it there — same effect, no CLI needed.)

5. **Run the app:**
   ```bash
   npm run dev --prefix apps/learning
   # or: cd apps/learning && npm run dev
   ```
   Visit http://localhost:3000.

## Project structure

```
IqraSpace/
├─ apps/learning/            # Next.js app (App Router)
│  ├─ src/app/           # (public): /, /login, /signup — (app): dashboard, classes, lessons,
│  │                     #   students, materials, schedule, attendance, progress, notes,
│  │                     #   meet, notifications, settings, teach/[lessonId] — share/[lessonId]
│  ├─ src/components/    # ui/ (design-system primitives), shell/ (Sidebar/Topbar/AppShell),
│  │                     #   pdf/ (PdfViewer), teach/ (TeachClient/ShareClient), lessons/
│  └─ src/lib/           # supabaseClient.ts, realtime.ts, sharing.ts, storage.ts,
│                        #   notifications.ts, quranContent.ts, theme.ts, format.ts
├─ supabase/
│  ├─ migrations/        # SQL schema (source of truth, see architecture §13) + expanded
│  │                     #   Phase 1 migrations 0005-0011 (see docs/PROGRESS.md)
│  └─ functions/         # Edge Functions (google-oauth-exchange, drive-file-proxy —
│                        #   code-complete, not yet deployed; see docs/PROGRESS.md)
├─ docs/PROGRESS.md      # phase-by-phase build log, decisions, deviations
└─ Iqra-space-architecture.md
```

## Notable deviations from the architecture doc

- **Router:** using Next.js **App Router** rather than the Pages Router file
  examples shown in architecture §19 (e.g. `pages/teach/[lessonId].tsx` →
  `app/teach/[lessonId]/page.tsx`). Same dynamic-route convention, App Router
  is Next's current default/recommended approach. No functional impact.
- **Local dev backend:** developing against a **hosted** Supabase free-tier
  project instead of the local Docker stack (`supabase start`), by user
  choice — avoids installing Docker Desktop (and its enterprise-use licensing
  caveats) on this machine. Same DB/Auth/Realtime/Storage APIs either way.
- **Architecture doc location:** kept at repo root (`Iqra-space-architecture.md`)
  instead of `docs/architecture.md` per §19, to avoid duplicating/renaming the
  file the user already has open. Purely cosmetic.
- **Phases 1–5 collapsed into one pass** (2026-08-29, at the user's explicit
  request, matching a supplied HTML product demo): the PDF viewer, live
  highlight-sync, attendance, schedule, progress, notes and notifications
  originally spread across architecture §20's Phases 2–5 are implemented now
  rather than later. See docs/PROGRESS.md's "Phase 1 (expanded scope)" entry.
- **Google Drive/Calendar OAuth is the one deliberate exception**: it needs a
  Google Cloud OAuth client (client ID/secret) that only the project owner
  can provision — not something achievable from this environment. Both Edge
  Functions (`google-oauth-exchange`, `drive-file-proxy`) are fully written
  and the "Connect Google Drive" UI builds a real consent-screen redirect, but
  neither Edge Function has been deployed, and the feature correctly shows a
  "not configured" state rather than faking a connection. Direct PDF upload
  to Supabase Storage (architecture §8's own "simpler fallback... recommended
  for the very first MVP cut") is the fully-working path for lesson materials
  today. Google Meet uses architecture §9's Option A (manual link) — no OAuth
  needed there at all, and it's fully functional.
