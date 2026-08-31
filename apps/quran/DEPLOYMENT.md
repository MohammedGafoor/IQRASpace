# IqraSpace Quran — Production Deployment

Status: **prepared, not yet deployed** — code, CI, and config are production-ready (see `PROJECT-STATUS.md`); the two Vercel projects and the `iqraspace.org` domain attachment happen once a Vercel token is available in this environment. This doc will be updated with real deployment IDs/URLs/DNS records once that happens — until then, values marked **TBD** are placeholders, not real.

## Architecture

Two independent deployments serve `iqraspace.org`, stitched together with [Next.js Multi-Zones](https://nextjs.org/docs/app/building-your-application/deploying/multi-zones) (`ARCHITECTURE.md` §8):

```text
https://iqraspace.org/           → apps/landing  (static page, owns the domain + DNS)
https://iqraspace.org/quran/*    → apps/quran    (Next.js, basePath="/quran", own deployment)
                                     ^ proxied via apps/landing/vercel.json's `rewrites`

https://iqraspace.vercel.app     → apps/web (separate product, separate Vercel project — unrelated, untouched)
```

Each app has its own `package.json` (or, for `apps/landing`, no build tooling at all — a plain static site), own Vercel project, own CI/CD workflow, own GitHub Actions secrets. A break in one never blocks or redeploys another.

| | apps/landing | apps/quran |
|---|---|---|
| Framework | None — static HTML/CSS, no build | Next.js 16.3.3 (App Router), React 19, TypeScript, Tailwind v4 |
| Package manager | n/a | npm |
| Node.js | n/a | `>=20.9.0` |
| Build command | n/a (Vercel serves the directory as-is) | `npm run build` → `next build` (Turbopack) |
| Lint / Typecheck | `html-validate` on `index.html`, JSON validation on `vercel.json` | `npm run lint` (ESLint) / `npm run typecheck` (`tsc --noEmit`) |
| Tests | none | none configured yet (`npm run test --if-present` is a no-op) |
| Repository | `github.com/MohammedGafoor/IQRASpace` (same repo, `apps/landing/`) | same repo, `apps/quran/` |
| Deployment branch | `main` | `main` |
| Vercel project | **TBD** | **TBD** |
| Production domain | `https://iqraspace.org` | `https://iqraspace.org/quran` (also directly reachable at its own `*.vercel.app` alias — **TBD**) |

## Environment variables

### `apps/landing`

None. It's a static page with no server code.

### `apps/quran`

Full purpose/detail for every variable lives in `apps/quran/.env.local.example` (committed, placeholders only). Summary of what's actually set where:

| Variable | Client-exposed? | Local dev | Vercel (Production) | Notes |
|---|---|---|---|---|
| `NEXT_BASE_PATH` | No (build-time only) | unset | `/quran` | Activates `next.config.ts`'s `basePath` — see `ARCHITECTURE.md` §8. |
| `QURAN_FOUNDATION_ENV` | No | `prelive` | `production` | Selects which credential pair below is used. |
| `QURAN_FOUNDATION_PROD_CLIENT_ID` / `_SECRET` | **No — never** | optional | ✅ | Only used by `npm run sync:content` (a manual, local step — see below), never by the deployed app itself. Deployed pages read pre-synced, **committed** JSON (`src/content/generated/`, see `.gitignore`'s note), not this API, at request time. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | ✅ | ✅ | Not used by any Phase 1 feature yet (reading is 100% local-first, `ARCHITECTURE.md` §5) — set for when Phase 5 (cross-device sync) lands, so it doesn't need a separate deploy step then. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | ✅ | ✅ | Publishable key; safe to expose (RLS is the real access control, per `supabase/migrations/0001_init_schema.sql`). |

**Content sync is deliberately not part of any pipeline here** — same principle as `apps/web`'s Supabase migrations (root `DEPLOYMENT.md`): a deploy should never silently re-fetch content from a third-party API. `npm run sync:content` is run manually/locally, its output (`src/content/generated/`) reviewed and committed like any other change, at least every 7 days per `QURAN-CONTENT.md`'s licensing term.

## GitHub Actions secrets required

Neither workflow can deploy until these repository secrets exist (GitHub → Settings → Secrets and variables → Actions). None are printed in workflow logs.

| Secret | Used by | Value |
|---|---|---|
| `LANDING_VERCEL_TOKEN` | `ci-landing.yml` | A Vercel API token scoped to the `apps/landing` project's team (vercel.com/account/tokens) |
| `LANDING_VERCEL_ORG_ID` | `ci-landing.yml` | **TBD** — from `apps/landing/.vercel/project.json` after `vercel link`, or the Vercel dashboard |
| `LANDING_VERCEL_PROJECT_ID` | `ci-landing.yml` | **TBD** — same source |
| `QURAN_VERCEL_TOKEN` | `ci-quran.yml` | A Vercel API token scoped to the `apps/quran` project's team |
| `QURAN_VERCEL_ORG_ID` | `ci-quran.yml` | **TBD** |
| `QURAN_VERCEL_PROJECT_ID` | `ci-quran.yml` | **TBD** |

Deliberately **not** GitHub secrets: `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY`, `QURAN_FOUNDATION_PROD_*`, `NEXT_BASE_PATH` — these live only in the Vercel dashboard's Environment Variables for the `apps/quran` project (`vercel pull` in the `deploy` job fetches them at build time), following the same pattern `apps/web`'s pipeline already uses.

## Deployment process (CI/CD)

```text
git push origin main
        ↓
GitHub Actions — path-filtered, only the app(s) that actually changed run
        ↓
  ci-landing.yml: validate (HTML/JSON check) → deploy (Vercel CLI, prebuilt, prod) → health check
  ci-quran.yml:   validate (lint/typecheck/build) → deploy (Vercel CLI, prebuilt, prod) → health check
        ↓
https://iqraspace.org (apps/landing)  +  https://iqraspace.org/quran (apps/quran, via the rewrite)
```

A pull request against `main` runs only each affected app's `validate` job — nothing deploys until merged. Pushing directly to `main` (small team) triggers the same sequence without a PR.

### One-time setup still required (only the project owner can do this — needs Vercel/GitHub account access)

1. Create the `apps/quran` Vercel project (root directory `apps/quran`), Hobby tier, set env vars from the table above.
2. Deploy it once to get its stable `*.vercel.app` alias; put that exact URL into `apps/landing/vercel.json`'s two `rewrites` entries (replacing the `REPLACE-WITH-QURAN-PROJECT.vercel.app` placeholder), commit, push.
3. Create the `apps/landing` Vercel project (root directory `apps/landing`, Framework Preset: **Other**), deploy it.
4. Add domain `iqraspace.org` (+ `www.iqraspace.org`, redirecting to the apex) to the `apps/landing` project via the Vercel dashboard or `vercel domains add`. Vercel will show the exact DNS records this specific domain needs — apply those at whichever registrar/DNS provider actually manages `iqraspace.org` today (**TBD which one** — confirm before assuming).
5. Add the six GitHub Actions secrets listed above.

### Rollback

Same pattern as `apps/web` (root `DEPLOYMENT.md`): Vercel keeps every past deployment. Vercel dashboard → the affected project → **Deployments** → pick a previous working deployment → **Promote to Production**. Each app's Vercel project is rolled back independently — rolling back `apps/quran` never touches `apps/landing` or vice versa.

### Troubleshooting a failed run

1. Open the failed GitHub Actions run → the red ✕ step names the stage (lint / typecheck / build / Vercel build / deploy / health check).
2. `validate` failing means the code has a real problem — reproduce locally (`npm run lint` / `npm run typecheck` / `npm run build` inside the affected app).
3. `deploy` failing on `vercel pull`/`vercel build`/`vercel deploy` almost always means a missing/incorrect `*_VERCEL_TOKEN`/`*_VERCEL_ORG_ID`/`*_VERCEL_PROJECT_ID` secret for that app.
4. Health check failing on `apps/quran` but the build/deploy succeeded: check that project's own Vercel Runtime Logs. If it's a 401/redirect instead of a real failure, this Vercel team may have Deployment Protection (SSO) on — see the caveat comment in `ci-quran.yml`'s health-check step; the fix is checking the stable alias instead of the ephemeral deploy URL, same as `apps/web`'s pipeline already does.
5. `apps/landing`'s `/quran` rewrite 404ing specifically (root `/` still works): `apps/landing/vercel.json`'s rewrite destination is stale — it must point at `apps/quran`'s *current* Vercel alias.

## Manual verification checklist (post-deploy)

- `https://iqraspace.org` loads the landing page; the "Open the Quran Reader" link goes to `https://iqraspace.org/quran` and it loads the Surah list correctly (through the rewrite, not directly).
- `https://www.iqraspace.org` redirects to `https://iqraspace.org` (no loop).
- A Surah, a Juz, and a Mushaf page all render Arabic text + translation correctly; an out-of-range number (e.g. `/quran/surah/999`) shows the branded not-found page, not a raw error.
- `https://iqraspace.org/quran/manifest.webmanifest` and `.../sitemap.xml` return 200 with `/quran`-prefixed paths inside.
- Browser console: no CSP violations, no mixed-content warnings, on both desktop and mobile widths.
