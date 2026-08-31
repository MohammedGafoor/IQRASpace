# PRODUCT-ROADMAP — IqraSpace Quran

Phases follow the numbering in [`Readme.md`](./Readme.md) §31. Each phase lists concrete scope, its exit criteria (per the master prompt's own Quality Gate, §35), and what is explicitly deferred. No phase starts before the previous one's exit criteria are met — "do not jump ahead" (§31).

## Phase 0 — Architecture and project foundation

- Research and document the Quran content provider: auth model, rate limits, licensing (commercial/non-commercial use, attribution requirements) — output: `QURAN-CONTENT.md`.
- Confirm infra decisions from `PROJECT-STATUS.md` §5 (separate Supabase project, separate Vercel project, domain).
- Scaffold `apps/quran`: Next.js (App Router) + TypeScript + Tailwind, ESLint, `tsc --noEmit`, mirroring `apps/web`'s proven config shape.
- Stand up the new Supabase project (empty schema) and new Vercel project (deploys a placeholder page).
- Add the path-filtered CI job for `apps/quran`.
- Build the minimal content sync script against the chosen provider for a single test Surah, end to end (fetch → validate → cache → render), to de-risk the riskiest architectural assumption before building the full reader.
- **Exit criteria:** `ARCHITECTURE.md`/`PRODUCT-ROADMAP.md`/`COST.md` reviewed; CI green on an empty scaffold; one Surah's worth of real content renders from the cache layer, not a live API call.

## Phase 1 — Core Quran Reader

- Navigation: Surah list, Surah detail, Juz navigation, page navigation, prev/next Surah, Ayah navigation, clean URL scheme (`/quran`, `/quran/[surah]`, `/quran/[surah]/[ayah]`, per §22 — final scheme documented as a decision once chosen).
- Display: Arabic Uthmani text, correct RTL, ayah numbers, clear verse separation, responsive typography.
- Translation: English, with the data model ready for more languages (no hardcoded single-language assumption in the schema or components).
- Reader controls: Arabic/translation font size, line spacing, theme (light/dark/system), reading width, translation visibility toggle — uncluttered, matching §10/§11.
- Continue Reading (local-only at this phase — no auth yet): last Surah/Ayah/position remembered per-device.
- Accessibility and responsive baseline built in from the start, not bolted on: semantic HTML, keyboard nav, focus states, WCAG 2.2 AA target for everything shipped this phase.
- **Exit criteria:** a visitor can open the app with no account, browse to any Surah, read it comfortably on a phone and a desktop, adjust font/theme, and return to their last position — all without a network request beyond the initial cached content load. Lighthouse Performance/Accessibility/Best Practices/SEO all measured (not necessarily 95+ yet, but measured and tracked).

### Status (2026-08-31) — real, working, and verified, but not yet complete

**Built and verified** (lint/typecheck/build clean; content confirmed real via curl against a production build, not assumed):
- Surah list (`/surah`) and Surah reader (`/surah/[surahNumber]`), statically generated per Surah (`generateStaticParams`), reading real synced Uthmani text + Abdel Haleem translation — no placeholder content.
- Full reader toolbar: Arabic/translation font scale, line spacing, reading width (narrow/comfortable/wide), translation visibility — all persisted to `localStorage`, applied via CSS custom properties on `<html>`.
- Theme: light/dark/system, explicit choice overriding system preference in both directions (see `globals.css`'s `data-theme` handling).
- Continue Reading: tracked per-ayah via `IntersectionObserver` while scrolling (not just "last Surah opened"), surfaced on the home page, deep-links back to the exact ayah (`/surah/2?ayah=45`) and scrolls to it.
- Bookmarking: per-ayah, local-only, no account — confirmed working against Al-Baqarah's all 286 ayahs, not just a short Surah.
- Baseline accessibility: skip-to-content link, visible focus rings, `prefers-reduced-motion` respected, semantic landmarks, ARIA labels/pressed-state on interactive controls, RTL (`dir="rtl"`/`lang="ar"`) on every Arabic text block.
- Per-Surah SEO metadata (`generateMetadata` — title/description); a 404 for a Surah number that doesn't exist (verified: `/surah/999` → real 404, not a crash).
- **Juz navigation** (`/juz`, `/juz/[juzNumber]`) and **Mushaf page navigation** (`/page`, `/page/[pageNumber]`) — both derived from data already synced (`verse.juz_number`/`page_number`), no new API calls. Both correctly span Surah boundaries (e.g. Juz 1 = all 7 ayahs of Al-Fatihah + the first 141 ayahs of Al-Baqarah = 148 ayahs, verified exactly), rendering a Surah-name heading wherever the Surah changes mid-list. 30 Juz and 604 Mushaf pages — the 604 is derived from the data, not hardcoded, and matches the standard Madinah Mushaf pagination. `/juz/31` and `/page/605` correctly 404.

**Content gap resolved (2026-08-31):** production API access was granted — all **114 Surahs, 6,236 verses** are now synced and rendering, verified programmatically (every Surah's verse count matches its chapter metadata exactly) and spot-checked live (`/surah` lists all 114, `/surah/114` and `/surah/2`'s 286 ayahs both render, `/surah/115` correctly 404s). See `QURAN-CONTENT.md` §4b.

**Ayah navigation added (2026-08-31):** a "Go to Ayah" control on the Surah reader jumps directly to any ayah in the currently open Surah (verified: `2:255` — Ayat al-Kursi — reachable by its DOM id). This satisfies Readme.md §10's "Ayah navigation" item specifically — it's distinct from, and doesn't substitute for, Phase 3's reference *search* (typing "2:255" from anywhere in the app), which still isn't built.

**Branding applied and complete (2026-08-31):** the real IqraSpace logo file is now in the repo (`public/brand/logo.png` — the single canonical source every generated brand image reads from, see `lib/branding/logo.ts`). The home page shows the full logo prominently (replacing the old text-only wordmark there); the header keeps the compact text wordmark (`components/layout/BrandWordmark.tsx`). Favicon, Apple touch icon, and OG share image are generated from the real artwork at build time (`src/app/icon.tsx`/`apple-icon.tsx`/`opengraph-image.tsx`, via `next/og` — no image-editing library was available in this environment) and verified by fetching and viewing each one.

Two more crops — just the book element and just the candle/star element (`src/app/brand/book-icon/route.tsx`, `candle-icon/route.tsx`) — were built for a homepage feature-icon section, then that section was removed per the user's own reference design (logo + tagline + CTA only, no feature cards, no Bismillah line). The two routes are still in the repo, correctly cropped and building cleanly, but **currently unused anywhere** — worth either wiring them in somewhere later or removing them if they end up staying dead code.

**Real bug found and root-caused, not worked around, while building those two crops:** Satori (`next/og`'s renderer) silently ignores an absolutely-positioned image's vertical offset when the crop's aspect ratio is very different from the output frame's (a large asymmetric letterbox) — it fell back to rendering the *entire* uncropped source instead of erroring. Confirmed via a throwaway debug route, not guessed: making the output frame's aspect ratio match the crop's own (no letterboxing needed) fixed it completely, regardless of how extreme the crop's own ratio is. Documented in `renderCroppedIcon.tsx`/`logo.ts` for whoever touches this next. Separately, true PNG transparency (`background: "transparent"` or omitting the property) doesn't work either — Satori defaults to opaque white — confirmed with a red-background test page, not assumed; the fix (`rgba(0,0,0,0)`) is already in `renderCroppedIcon.tsx`. Neither issue affects `icon.tsx`/`apple-icon.tsx`/`opengraph-image.tsx`, which all use a solid background and a crop ratio close enough to their frame to be unaffected.

**Accessibility/responsive check run and two real bugs fixed (2026-08-31).** No `chromium-cli`/Playwright/axe pre-installed in this environment — `playwright-core` (driving the system's existing Chrome, no browser download) and `axe-core` were installed with `--no-save` (never touched `package.json`, confirmed after) and removed once done. Method: 4 representative pages (home, a 286-ayah Surah, a cross-Surah Juz, the Mushaf page grid) × all 8 breakpoints §34 lists (320–1440px), checking `document.documentElement.scrollWidth` for horizontal overflow at each, plus one full `axe.run()` accessibility scan per page and a browser-console-error check.

Result: **zero horizontal overflow at any breakpoint, zero console errors** — genuinely measured, not assumed. The axe scan found two real issues, both fixed and re-scanned to confirm (**zero violations remaining** across all 4 pages):
1. The gold accent color (`#b8873a`) only reached 3.2:1 contrast on white — fails WCAG AA's 4.5:1 for text. Added a separate, darkened `--color-accent-text` token (`#8a6420`, 5.35:1) for every place gold is used *as text* (the wordmark, the "Bookmarked" label, a form error) — the original gold stays as-is for backgrounds/borders/decorative rules, where contrast rules don't apply the same way. Dark mode's gold already passed (8.18:1+), so it needed no change.
2. Every reader page had two identically-labeled `<nav aria-label="Navigation">` landmarks (`ReaderNavBar` renders at both top and bottom of the ayah list) — confusing for landmark-based screen-reader navigation. Fixed by making only the top one a real `<nav>` landmark; the bottom copy is now a plain `<div>` (still a convenience repeat, just not a second landmark to jump to).

**What this is NOT:** axe-core's automated ruleset covers roughly a third of WCAG's actual success criteria by its own documentation — real coverage, not the full picture. No manual screen-reader walkthrough, no keyboard-only navigation walkthrough, and no visual/manual review of the 8 breakpoints beyond the overflow check (2 were screenshotted and eyeballed — 375px and 1280px — not all 8) has been done. That gap, plus a full WCAG 2.2 AA criteria review, is still Phase 7's job — this pass closes Phase 1's "don't ship a known, findable bug" bar, not Phase 7's formal audit bar.

**Not yet done — Phase 1 is not complete:**
- Ruku/Hizb navigation (data is already synced per-verse, same as Juz/Page — just not asked for, so not built).
- Multiple translations shown together (the data model already supports it — `verse.translations` is an array — only the UI currently shows just the first one).
- No Open Graph tags, structured data, sitemap, or robots.txt yet (§22) — deferred to Phase 9 polish, tracked, not forgotten.
- No automated tests exist for any of this yet.

## Phase 2 — Audio

- Reciter selection, play Ayah/Surah, pause/resume/prev/next, playback progress, auto-advance, current-Ayah highlighting, repeat Ayah, playback speed.
- Audio streamed from an external reciter CDN (per `ARCHITECTURE.md` §7) — no self-hosted audio storage.
- Repeat-range if it proves straightforward with the chosen audio source; otherwise documented as deferred, not silently dropped.
- **Exit criteria:** audio plays reliably on mobile Safari/Chrome (the two most failure-prone audio-autoplay environments), reading still works with audio blocked/unavailable (§42).

## Phase 3 — Search

- Arabic text, English translation, Surah name, and direct Ayah-reference search (e.g. "2:255").
- Simplest reliable implementation measured against real usage first (Postgres full-text search or a shipped client-side index) — no Elasticsearch (§14).
- **Exit criteria:** search returns correct results for Arabic, translation, and reference queries within a target latency set once real data volume is known; browsing still works if search is ever degraded.

## Phase 4 — Bookmarks and Continue Reading

- Add/remove/view Ayah bookmarks, working entirely locally (no login).
- Continue Reading surfaced on the home page.
- **Exit criteria:** bookmarks and last position survive a page reload and a browser restart on the same device.

## Phase 5 — Authentication and synchronization

- Optional sign-in (only for cross-device sync — never required for reading).
- Sync bookmarks, reading history, preferences to the Supabase project once signed in; local data upgrades to synced data rather than being discarded.
- **Exit criteria:** signing in on a second device restores the same bookmarks/position/preferences; signing out leaves local-only functionality fully intact.

## Phase 6 — PWA and offline

- Installable PWA: manifest, icons, splash screen, offline app shell, static-asset caching.
- Offline Arabic Quran text + selected translation is evaluated here, not assumed — implemented only if the caching/storage cost analysis in `COST.md` still holds at that point.
- **Exit criteria:** the app installs on iOS/Android/desktop and the shell loads offline; a clear "you're offline, here's what's available" state exists rather than a broken page.

## Phase 7 — Accessibility and performance hardening

- Full WCAG 2.2 AA pass with automated (axe or equivalent) + manual testing of the reader workflows.
- Lighthouse targets (95+ across Performance/Accessibility/Best Practices/SEO) actually hit and tracked, not just aspired to.
- **Exit criteria:** documented automated + manual accessibility test results; Lighthouse scores recorded for the reader, search, and home pages at the required device widths (§34).

## Phase 8 — Multilingual support

- Additional UI + translation languages beyond ar/en (per §21's list), added through the i18n architecture built in Phase 1 — no component-level hardcoded English strings to retrofit.
- **Exit criteria:** adding a new language is a content/config change, not a code change, for at least one additional language added end-to-end as proof.

## Phase 9 — Production readiness

- Privacy Policy, Terms of Use, content-attribution page (§28, §7) published before any real public launch.
- Monitoring (uptime, errors, deployment failures) on free/low-cost tooling.
- Full security review pass (§24) and a completed `SECURITY.md`/`DATABASE.md`/`DEPLOYMENT.md`/`COST.md` set for this app.
- **Exit criteria:** every document listed in §32 exists and is current for `apps/quran`; a real production deploy (not just pilot) is live behind the domain decided in Phase 0.

## Phase 10 — Future IqraSpace learning ecosystem

- Not started, not designed in detail, per the master prompt's own instruction (§40: "do not implement this now unless required"). The Quran Reader must keep working standalone even if this ecosystem never gets built. Revisit only when there's a genuine, funded requirement.

---

## Cross-cutting, every phase

- Definition of Done (§45) applies per feature, not per phase: responsive, accessible, tested, error-handled, performant, cost-conscious, documented, non-regressive.
- Every phase's cost impact gets reviewed against `COST.md` before being called complete (§38).
- Feature ideas that surface outside the current phase are recorded (in this file or a future `DECISIONS.md`), not built early (§37).
