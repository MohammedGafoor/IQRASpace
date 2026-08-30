# IqraSpace — Pilot Deployment

Status: **pilot** (no custom domain yet — temporary Vercel URL only).

## Application

| | |
|---|---|
| Framework | Next.js 16.3.3 (App Router), React 19, TypeScript, Tailwind v4 |
| App location | `apps/web/` (monorepo root only holds the Supabase CLI devDependency) |
| Package manager | npm |
| Node.js | `>=20.9.0` (pinned in `apps/web/package.json` `engines`) |
| Build command | `npm run build` (repo root) → delegates to `apps/web` → `next build` |
| Start command | `npm run start` (repo root) → `next start` |
| Lint | `npm run lint` → `apps/web` → `eslint` |
| Type check | `npm run typecheck` → `apps/web` → `tsc --noEmit` |
| Tests | none configured yet (`npm run test --if-present` is a no-op) |
| Repository | https://github.com/MohammedGafoor/IQRASpace |
| Deployment branch | `main` |
| Deployment platform | Vercel |
| Deployment URL | **https://iqraspace.vercel.app** (temporary Vercel domain, aliases the latest Production deployment) |

## Supabase

| | |
|---|---|
| Project | `IQRASpace Project` (ref `pqlrexhtwgleokyiamie`) — existing hosted project, reused as-is |
| Database | Postgres, 23 migrations in `supabase/migrations/`, applied via `supabase db push` and verified live (`supabase migration list --linked`) |
| Auth | Username + password (email optional) — see `supabase/migrations/0019_username_auth.sql`. `site_url` / `additional_redirect_urls` (in `supabase/config.toml`, pushed via `supabase config push`) include both `http://localhost:3000` (local dev) and `https://iqraspace.vercel.app` (pilot) |
| Storage | `lesson-materials` bucket (private; tutor writes to own folder, read open to any authenticated user, admin bypass — see `0011`/`0018`) |
| Edge Functions | `admin-user-management` (deployed — user create/reset-password/deactivate/delete), `google-oauth-exchange` / `drive-file-proxy` (written, **not deployed** — Drive integration deferred, no Google credentials provisioned) |
| Roles | `super_admin`, `admin`, `tutor`, `student` (`guardian` supported but unused) — see `docs/PROGRESS.md` for full history |

**Nothing about the Supabase project's schema, RLS, or auth model changed for this deployment** beyond the two Auth config values above — this is the same project local dev already points at.

## Environment Variables

Local dev (`apps/web/.env.local`, gitignored) is documented end-to-end in `apps/web/.env.local.example` — every variable's purpose, whether it's browser- or server-only, and which are optional. Summary of what's actually live where:

| Variable | Client-exposed? | Local dev | Vercel (Production + Preview) | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | ✅ | ✅ | Required — app throws at import time if missing |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | ✅ | ✅ | Publishable key; safe to expose (RLS is the real access control) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Yes | not set | not set | Optional feature flag — Google Drive tab stays "not configured" while unset, same as local |
| `NEXT_PUBLIC_GOOGLE_REDIRECT_URI` | Yes | not set | not set | Same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | **No — never** | ✅ (local scripts only) | **not set** | Only consumed by local one-off scripts (`npm run seed:admins`) and Edge Functions (which get it automatically from the Supabase platform). The deployed Next.js app itself never reads it — confirmed, nothing under `apps/web/src` references it. |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_*`, `DATABASE_URL` | No | ✅ (CLI/local only) | not set | Supabase CLI / direct-Postgres access only, never read by app code |
| `ADMIN_*` / `SUPER_ADMIN_*` / `DEMO_*` | No | ✅ (seed script only) | not set | Consumed only by `npm run seed:admins`, run locally |

Only **two** variables are set in Vercel, on purpose — everything else the app doesn't read is deliberately kept out of the deployment (Phase 8's "only expose what genuinely needs to be public").

## Pilot Accounts

Four roles exist, matching the pilot spec (see `docs/PROGRESS.md` "Username-based auth + user cleanup" for provisioning history):

| Role | Username |
|---|---|
| Super Admin | `superadmin` |
| Admin | `admin` |
| Tutor | `Shaanu` |
| Student | `Std001` |

Login is by **username + password** — email is optional everywhere and not used to sign in. Passwords are never committed to the repo; set/reset them via the Admin → Manage Users screen ("Reset / Change Password") or `npm run seed:admins` (admin/super_admin only, reads `.env.local`). Note: as of this pilot setup, five additional student test accounts (`Std002`–`Std006`) from earlier QA sessions are still present in the database — left in place at the user's request; clean up via Admin → Manage Users → Delete whenever convenient.

## Deployment Process (CI/CD)

```text
git push origin main
        ↓
GitHub Actions (.github/workflows/ci.yml)
        ↓
  job: validate  — npm ci, lint, typecheck, test --if-present, build
        ↓ (only for a push to main, not PRs)
  job: deploy     — vercel pull → vercel build --prod → vercel deploy --prebuilt --prod
        ↓
  health check    — curl "/" and "/login", must be HTTP 200
        ↓
https://iqraspace.vercel.app (Production)
```

A pull request against `main` runs only the `validate` job (lint/typecheck/build gate) — nothing is deployed until it's merged to `main`. Every push to `main` re-runs `validate` and then, only if that passes, deploys automatically. **No manual `vercel deploy` is needed for normal development** — see "Everyday workflow" below.

### One-time setup already done

- Vercel project `shaga2/iqraspace` created and linked to this codebase (`apps/web` as the app root).
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in Vercel (Production + Preview environments).
- Supabase Auth `site_url`/`additional_redirect_urls` include the Vercel URL (see above).

### One-time setup required from you (GitHub Secrets)

The workflow needs these five **GitHub Actions secrets** (repo → Settings → Secrets and variables → Actions → New repository secret) — none of these are printed in workflow logs:

| Secret | Value |
|---|---|
| `VERCEL_TOKEN` | The Vercel API token already used to set this deployment up (vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | `team_FXkdH5PjVawG5qfuheLlST0K` |
| `VERCEL_PROJECT_ID` | `prj_YsuXnkbPqGKZw8cmv1waXAkF3vzs` |
| `NEXT_PUBLIC_SUPABASE_URL` | Same value as `apps/web/.env.local` — not secret, just kept as a GitHub Secret for consistency |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same value as `apps/web/.env.local` — the publishable key, not secret |

**The pipeline cannot deploy until these are added.** Until then, the `validate` job still runs and gates PRs correctly; only the `deploy` job is blocked.

### Also required: connect GitHub to Vercel (manual, one-time)

Vercel refused to auto-link the GitHub repo during setup with: *"You need to add a Login Connection to your GitHub account first."* This doesn't block the GitHub Actions pipeline above (it deploys via the Vercel CLI + token, independent of Vercel's own Git integration) — but if you'd also like Vercel's dashboard to show commit/PR context on deployments, connect GitHub once at vercel.com/account/login-connections, then optionally run `vercel git connect` from `apps/web`.

### Everyday workflow (after the one-time setup above)

```bash
git checkout -b feature/my-change
# ...edit...
git add -A && git commit -m "..."
git push -u origin feature/my-change
# open a PR into main — CI (lint/typecheck/build) runs automatically
# merge the PR
# → main is updated → CI runs again → deploy job runs → live at
#   https://iqraspace.vercel.app within a few minutes
```

Or, pushing directly to `main` (small pilot team) triggers the same `validate` → `deploy` sequence without a PR.

### Viewing deployment status

- GitHub → **Actions** tab → the `CI/CD` workflow run for your commit. The `deploy` job's summary tab shows commit SHA, branch, run number, timestamp, and the exact deployment URL.
- Vercel dashboard → `shaga2/iqraspace` → **Deployments** — full build logs, and every past deployment stays browsable/promotable.

### Troubleshooting a failed run

1. Open the failed GitHub Actions run → the red ✕ step tells you which stage failed (lint / typecheck / test / build / Vercel build / deploy / health check).
2. `validate` failing means the code itself has a problem — fix it locally (`npm run lint`, `npm run typecheck`, `npm run build` inside `apps/web` reproduce the same checks) and push again.
3. `deploy` failing on `vercel pull`/`vercel build`/`vercel deploy` almost always means a missing/incorrect secret (`VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`) — re-check the GitHub Secrets above.
4. Health check failing means the app built and deployed but didn't serve `200` on `/` or `/login` — check the Vercel deployment's own Runtime Logs (dashboard → Deployments → the deployment → Logs) for the actual server error.

### Rollback

No custom rollback tooling was built — Vercel already keeps every past deployment. To roll back: Vercel dashboard → `shaga2/iqraspace` → **Deployments** → pick a previous (working) deployment → **Promote to Production**. Equivalently via CLI: `vercel rollback [deployment-url] --token=...`.

### Database migrations — deliberately manual, not part of this pipeline

This pipeline **never** touches the Supabase database. `supabase/migrations/*.sql` files are version-controlled, but applying them (`supabase db push`, run from the repo root with `SUPABASE_ACCESS_TOKEN` exported) stays a manual step a developer runs deliberately, same as throughout this project's history (see `docs/PROGRESS.md`). This is intentional: a code push should never silently run schema changes against the shared pilot database. When a PR includes a new migration file, apply it yourself (`supabase db push`) before or after merging, independent of the CI/CD run.

## Manual verification checklist (post-deploy)

Not yet scripted end-to-end in CI beyond the `/` and `/login` health check. Before/after a deploy, spot-check:

- Admin/Super Admin/Tutor/Student can each log in by username.
- Materials page: `Holy-Quran-Para-1.pdf` and `Noorani_Qaida.pdf` preview correctly (pages render, not blank — see `docs/PROGRESS.md`'s JBIG2/WASM fix), zoom, full-screen, and annotation tools work.
- Schedule: booking a one-time session for a specific student, and the Today's Sessions list, both work.
- Browser console / Network tab: no Supabase/auth/CORS errors on either desktop or mobile widths.
