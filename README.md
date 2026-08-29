# IQRASpace — Quranic Teacher

Online Quran learning management for a solo tutor and their students. Full
architecture, requirements, and rationale live in
[`Iqra-space-architecture.md`](./Iqra-space-architecture.md) — read that first.

Build status and phase-by-phase notes: [`docs/PROGRESS.md`](./docs/PROGRESS.md).

## Stack

- **Frontend:** Next.js 16 (App Router, TypeScript, Tailwind CSS) — `apps/web`
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
   npm install --prefix apps/web
   ```

2. **Create a Supabase project:**
   - Go to https://supabase.com/dashboard → New Project (free tier, no card required).
   - Once it's provisioned, go to **Project Settings → API** and copy the **Project URL** and **anon public key**.

3. **Configure the frontend env:**
   ```bash
   cp apps/web/.env.local.example apps/web/.env.local
   # then edit apps/web/.env.local with the URL + anon key from step 2
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
   npm run dev --prefix apps/web
   # or: cd apps/web && npm run dev
   ```
   Visit http://localhost:3000.

## Project structure

```
IqraSpace/
├─ apps/web/            # Next.js app (App Router)
│  ├─ src/app/           # routes: dashboard, classes, lessons, teach/[lessonId], share/[lessonId]
│  ├─ src/components/    # pdf/, dashboard/
│  └─ src/lib/           # supabaseClient.ts, realtime.ts
├─ supabase/
│  ├─ migrations/        # SQL schema (source of truth, see architecture §13)
│  └─ functions/         # Edge Functions (google-oauth-exchange, drive-file-proxy — Phase 2)
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
