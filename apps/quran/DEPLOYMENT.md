# IqraSpace Quran — Production Deployment

Status: **deployed to Vercel, CI/CD verified end-to-end, DNS pending.** Both apps are live and verified working on their `*.vercel.app` aliases, including the full Multi-Zones stitch (`https://iqraspace-landing.vercel.app/quran` correctly proxies to the `apps/quran` deployment). All 6 GitHub Actions secrets are set and a real `git push` → `validate` → `deploy` → `health check` run has succeeded for both `ci-quran.yml` and `ci-landing.yml` — the automated pipeline described below is no longer aspirational, it's confirmed working. `iqraspace.org` itself is added to the `apps/landing` Vercel project but **not yet resolving** — the domain's DNS is hosted at Cloudflare and doesn't point at Vercel yet. See "DNS — action required" below; that's the one remaining step before `https://iqraspace.org` goes live.

Two real bugs were found and fixed getting CI green (both were **local Vercel CLI build-packaging quirks, not app bugs** — see their `git log` commits and the inline comments in each workflow for full detail): `apps/quran`'s prebuilt flow failed lambda-tracing on legitimate SSG routes; `apps/landing`'s prebuilt flow served `/robots.txt` correctly but 404'd on `/` from the same deploy. Both workflows now use `vercel deploy --prod` (remote build) instead of the local `vercel build`/`--prebuilt` flow `apps/web`'s `ci.yml` uses — deliberately different from that proven pattern, not an oversight. Do not reintroduce the prebuilt flow without confirming upstream has actually fixed this.

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
| Build command | n/a (Vercel serves the directory as-is) | Vercel's remote build (`next build`, Turbopack) — see note below on why not a local prebuild |
| Lint / Typecheck | `html-validate` on `index.html`, JSON validation on `vercel.json` | `npm run lint` (ESLint) / `npm run typecheck` (`tsc --noEmit`) |
| Tests | none | none configured yet (`npm run test --if-present` is a no-op) |
| Repository | `github.com/iqraspace-admin/IQRASpace` (same repo, `apps/landing/`) | same repo, `apps/quran/` |
| Deployment branch | `main` | `main` |
| Vercel team | `shaga2` (same team as `apps/web` — a genuinely-personal-account scope was attempted first but this token/CLI combination could not target it; projects stay isolated via separate Vercel projects/secrets regardless) | `shaga2` |
| Vercel project | `iqraspace-landing` (`prj_lnlOOiPb0xuraZDGnGEPWMPvpTr1`) | `iqraspace-quran` (`prj_Xoa0J8m5m1gsijkBKI3IUDCKipR5`) |
| Stable alias (works today) | `https://iqraspace-landing.vercel.app` | `https://iqraspace-quran.vercel.app/quran` |
| Production domain (pending DNS) | `https://iqraspace.org` | `https://iqraspace.org/quran` |

### Why `apps/quran` doesn't use the "prebuilt" deploy flow

`ci.yml` (`apps/web`) and `ci-landing.yml` both use `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod` (build locally/in the runner, then upload the finished output). During `apps/quran`'s first real deploy, `vercel build`'s local lambda-tracing step failed outright — first on `/brand/book-icon` (since removed as dead code, see below), then, once that was gone, on a real route: `Unable to find lambda for route: /juz/1`. This reproduced consistently and affected legitimate SSG routes, not just the removed ones — a real Vercel CLI 59.x / Next.js 16 Turbopack compatibility issue with the local Build Output API packaging step, not a bug in this app's code (confirmed: plain `next build` succeeds cleanly, `npm run lint`/`typecheck` are clean, and `vercel deploy --prod` — letting Vercel's own remote build pipeline build it — works). `ci-quran.yml`'s `deploy` job therefore uses `vercel deploy --prod` directly. Revisit the prebuilt flow if this is ever fixed upstream (it would shave a little time off the deploy by not re-fetching dependencies on Vercel's build machines, but isn't otherwise necessary).

### A real bug found and fixed during this deployment

`src/app/brand/book-icon/route.tsx` and `candle-icon/route.tsx` (two decorative icon routes, already flagged in `SETUP.md` as "currently unused, kept in case they're wanted elsewhere") were deleted — confirmed via a repo-wide search that nothing referenced them, and they were the direct cause of the Vercel build failure above. The shared helper they used (`src/lib/branding/renderCroppedIcon.tsx`) is untouched and still used by `icon.tsx`/`apple-icon.tsx`/`opengraph-image.tsx`, which do work.

## Environment variables

### `apps/landing`

None. It's a static page with no server code.

### `apps/quran`

Full purpose/detail for every variable lives in `apps/quran/.env.local.example` (committed, placeholders only). Actual Vercel configuration (Production + Preview, both apply to every real deploy and every PR preview):

| Variable | Client-exposed? | Type in Vercel | Notes |
|---|---|---|---|
| `NEXT_BASE_PATH` | No (build-time only) | Config (readable) | `/quran` — activates `next.config.ts`'s `basePath`. Deliberately **not** Secret type: `vercel pull` can't retrieve Secret-type values (returns a `[SENSITIVE]` placeholder string), which would have silently broken every route's `basePath` if this app ever used the local prebuilt flow again. |
| `QURAN_FOUNDATION_ENV` | No | Secret | `production` |
| `QURAN_FOUNDATION_PROD_CLIENT_ID` / `_SECRET` | **No — never** | Secret | Only used by `npm run sync:content` (a manual, local step — see below), never by the deployed app itself. Deployed pages read pre-synced, **committed** JSON (`src/content/generated/`, see `.gitignore`'s note), not this API, at request time — confirmed safe for these two to stay Secret-type/unpullable, since nothing in the Next.js build or runtime reads them. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Config | Not used by any Phase 1 feature yet (reading is 100% local-first, `ARCHITECTURE.md` §5) — set now so Phase 5 (cross-device sync) doesn't need a separate deploy step later. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Config | Publishable key; safe to expose (RLS is the real access control, per `supabase/migrations/0001_init_schema.sql`). |

**Content sync is deliberately not part of any pipeline here** — same principle as `apps/web`'s Supabase migrations (root `DEPLOYMENT.md`): a deploy should never silently re-fetch content from a third-party API. `npm run sync:content` is run manually/locally, its output (`src/content/generated/`) reviewed and committed like any other change, at least every 7 days per `QURAN-CONTENT.md`'s licensing term.

## DNS — action required

`iqraspace.org`'s DNS is hosted at **Cloudflare** (nameservers `harley.ns.cloudflare.com` / `kia.ns.cloudflare.com` — confirmed via `vercel domains inspect`, not assumed). The domain is already added to the `iqraspace-landing` Vercel project, and `www.iqraspace.org` is already configured to 308-redirect to the apex once both resolve. What's missing is the actual DNS records — **add these two in the Cloudflare dashboard** (these are the exact records Vercel's own `vercel domains inspect` returned, not guessed):

| Type | Name | Value | Cloudflare proxy status |
|---|---|---|---|
| A | `iqraspace.org` (root/`@`) | `76.76.21.21` | **DNS only** (grey cloud) |
| A | `www.iqraspace.org` | `76.76.21.21` | **DNS only** (grey cloud) |

**Important:** set both records to Cloudflare's "DNS only" mode, not "Proxied" — leaving Cloudflare's proxy on would put Cloudflare's edge in front of Vercel's, which commonly causes TLS certificate issues and redirect loops (Vercel needs to see and terminate the real TLS handshake to issue/renew its own certificate for the domain). This matches the objective's own "avoid unnecessary proxy/CDN conflicts" requirement.

Once added, Vercel auto-verifies (an email confirms it) and issues HTTPS certificates for both `iqraspace.org` and `www.iqraspace.org` automatically — no separate certificate step. Re-run `vercel domains inspect iqraspace.org` to confirm the warning clears.

## GitHub Actions secrets — set and verified working

All 6 are set (GitHub → Settings → Secrets and variables → Actions) and a real `push` → `deploy` → `health check` run has succeeded end-to-end for both workflows (2026-08-31).

| Secret | Used by | Value |
|---|---|---|
| `LANDING_VERCEL_TOKEN` | `ci-landing.yml` | A Vercel API token for the `shaga2` team |
| `LANDING_VERCEL_ORG_ID` | `ci-landing.yml` | `team_FXkdH5PjVawG5qfuheLlST0K` |
| `LANDING_VERCEL_PROJECT_ID` | `ci-landing.yml` | `prj_lnlOOiPb0xuraZDGnGEPWMPvpTr1` |
| `QURAN_VERCEL_TOKEN` | `ci-quran.yml` | Same Vercel team token as above (both projects are in `shaga2`) |
| `QURAN_VERCEL_ORG_ID` | `ci-quran.yml` | `team_FXkdH5PjVawG5qfuheLlST0K` |
| `QURAN_VERCEL_PROJECT_ID` | `ci-quran.yml` | `prj_Xoa0J8m5m1gsijkBKI3IUDCKipR5` |

Deliberately **not** GitHub secrets: `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY`, `QURAN_FOUNDATION_PROD_*`, `NEXT_BASE_PATH` — these live only in the Vercel dashboard's Environment Variables for the `apps/quran` project (already set, see table above), following the same pattern `apps/web`'s pipeline already uses.

**Security note:** during this session, a Vercel token, then a GitHub PAT, then a second Vercel token were each pasted directly into chat rather than passed via the local-file method requested — meaning all three are present in this session's conversation history/logs, even though only the values were ever written to local files, never echoed back out. Nothing was left broken because of it, but **all three should be rotated/revoked** once you've confirmed everything above still works after doing so: the original interactive Vercel token, the GitHub PAT (github.com/settings/tokens), and the `LANDING_VERCEL_TOKEN`/`QURAN_VERCEL_TOKEN` value itself (generate a new Vercel token, update both GitHub secrets to the new value, then revoke the old one).

## Deployment process (CI/CD)

```text
git push origin main
        ↓
GitHub Actions — path-filtered, only the app(s) that actually changed run
        ↓
  ci-landing.yml: validate (HTML/JSON check) → deploy (Vercel CLI, remote build, prod) → health check
  ci-quran.yml:   validate (lint/typecheck/build) → deploy (Vercel CLI, remote build, prod) → health check
        ↓
https://iqraspace.org (apps/landing)  +  https://iqraspace.org/quran (apps/quran, via the rewrite)
```

A pull request against `main` runs only each affected app's `validate` job — nothing deploys until merged. Pushing directly to `main` (small team) triggers the same sequence without a PR. **Verified working end-to-end** (2026-08-31): commit `a057b35`'s push through both `ci-quran.yml` and `ci-landing.yml` ran validate → deploy → health check successfully, with no manual intervention beyond the secrets already being in place. This is the same pipeline any future `git push` to `main` will go through.

### One-time setup already done

1. ✅ `apps/quran` Vercel project created, env vars set, deployed — live at its alias.
2. ✅ `apps/landing` Vercel project created, deployed, `vercel.json`'s rewrite points at the real `apps/quran` alias — live at its alias, full `/quran` proxy verified working end-to-end.
3. ✅ `iqraspace.org` + `www.iqraspace.org` added to the `apps/landing` project; `www` → apex redirect configured.

### One-time setup still required (only the project owner can do this)

1. **DNS** — add the two Cloudflare A records above (this is what's blocking `https://iqraspace.org` from resolving right now).
2. Rotate the three tokens per the security note above.
3. Once DNS resolves, run the manual responsive/cross-browser spot-check below — this sandbox has no headless browser, so it's real signal this pass couldn't produce itself.

### Manual responsive / cross-browser spot-check (do this once DNS resolves)

This sandbox has no headless browser, so this is the one verification step in the whole deployment that genuinely needs a human with a real browser — static analysis (below) is supporting evidence, not a substitute. At each width, open `https://iqraspace.org` and `https://iqraspace.org/quran/surah/2` (a long Surah — Al-Baqarah — exercises the reader more than the short homepage):

| Width | Device class | What to check |
|---|---|---|
| 320px | Smallest phone | Header/nav doesn't overlap or clip; no horizontal scrollbar anywhere |
| 375px, 390px, 430px | Modern phones | Reader controls (font/theme/width toolbar) remain tappable, don't overlap the Arabic text; RTL Arabic block and LTR translation both readable side-by-side or stacked without overflow |
| 768px | Tablet | Layout transitions cleanly from mobile to wider — no leftover mobile-only nav artifacts, no premature desktop-width assumptions |
| 1024px, 1280px | Small/laptop desktop | Reader stays centered at its max-width (doesn't stretch full-bleed and hurt line length); footer stays at the bottom, not stranded mid-page |
| 1440px, 1920px | Large desktop | Same centered max-width holds; verify nothing looks sparse/broken on very wide viewports |

At any two widths (e.g. 390px and 1280px), also check: theme toggle (light/dark) actually switches and persists on reload; a bookmark set on the reader survives a refresh; browser back/forward after navigating Surah → Juz → back lands correctly; and the browser console has zero errors (CSP violations would show here first if the header policy is ever too strict for a future change).

**What this session verified without a browser** (real signal, not a substitute for the above): `curl`-based checks confirm correct `lang="en" dir="ltr"` on the shell with `dir="rtl"` on Arabic verse blocks, a `viewport` meta tag, working `prefers-color-scheme: dark` CSS, and no CSP/header errors on any fetched route. The codebase uses fluid CSS (`clamp()` for type scale, CSS Grid `minmax()/auto-fill` for the Mushaf-page grid, `max-width` for line length) rather than fixed breakpoints, consistent with the automated 8-breakpoint axe-core pass already recorded in `PROJECT-STATUS.md` (0 violations) from Phase 1 development.

### Rollback

Same pattern as `apps/web` (root `DEPLOYMENT.md`): Vercel keeps every past deployment. Vercel dashboard → the affected project → **Deployments** → pick a previous working deployment → **Promote to Production**. Each app's Vercel project is rolled back independently — rolling back `apps/quran` never touches `apps/landing` or vice versa.

### Troubleshooting a failed run

1. Open the failed GitHub Actions run → the red ✕ step names the stage (lint / typecheck / build / Vercel deploy / health check).
2. `validate` failing means the code has a real problem — reproduce locally (`npm run lint` / `npm run typecheck` / `npm run build` inside the affected app).
3. `deploy` failing on `vercel deploy`/`vercel pull`/`vercel build` almost always means a missing/incorrect `*_VERCEL_TOKEN`/`*_VERCEL_ORG_ID`/`*_VERCEL_PROJECT_ID` secret for that app.
4. Health check failing on `apps/quran` but the deploy step succeeded: check that project's own Vercel Runtime Logs (dashboard → `iqraspace-quran` → Deployments → the deployment → Logs). Note both projects' team has Deployment Protection (SSO) on — `ci-quran.yml`'s health check deliberately targets the stable `https://iqraspace-quran.vercel.app` alias, not the ephemeral per-deploy URL, for exactly this reason (same fix `ci.yml`/`apps/web` already uses).
5. `apps/landing`'s `/quran` rewrite 404ing specifically (root `/` still works): `apps/landing/vercel.json`'s rewrite destination is stale — it must point at `apps/quran`'s *current* Vercel alias (currently `https://iqraspace-quran.vercel.app`, correct as of this deploy).

## Manual verification checklist (post-deploy)

Verified via `.vercel.app` aliases already (2026-08-31) — re-verify against the real domain once DNS resolves:

- ✅ `https://iqraspace-landing.vercel.app` loads the landing page; `/quran` link works.
- ✅ `https://iqraspace-landing.vercel.app/quran`, `/quran/surah/1`, `/quran/manifest.webmanifest` all load correctly through the rewrite.
- ✅ `robots.txt` lists both sitemaps; response headers show the correct, non-colliding CSP on each side of the rewrite (landing's own strict `script-src 'none'` on `/`, `apps/quran`'s `script-src 'self'` on `/quran/*` — confirmed these don't merge/conflict).
- ☐ `https://iqraspace.org` and `https://www.iqraspace.org` (pending DNS).
- ☐ A Surah, a Juz, and a Mushaf page render correctly on the real domain; an out-of-range number (e.g. `/quran/surah/999`) shows the branded not-found page.
- ☐ Browser console: no CSP violations, no mixed-content warnings, desktop and mobile.
