# ARCHITECTURE — IqraSpace Quran

Proposed architecture for the public Quran reading platform described in [`Readme.md`](./Readme.md). Companion docs: [`PROJECT-STATUS.md`](./PROJECT-STATUS.md) (why these choices), [`PRODUCT-ROADMAP.md`](./PRODUCT-ROADMAP.md) (when), [`COST.md`](./COST.md) (what it costs).

Every decision below follows the master prompt's own rule (§33): decision, alternatives, reason, cost impact, future reversibility. Anything marked **[NEEDS VERIFICATION]** is a claim about a third-party API/free-tier/ToS that must be re-checked against current documentation before being relied on — not assumed from training data, per the source repo's own precedent (`Iqra-space-architecture.md`'s freshness note).

---

## 1. High-level shape

```
Quran Foundation / Quran.com API  (source of truth for text/translations/audio metadata)
        │
        ▼
Content Sync Layer (build-time + scheduled revalidation)
        │
        ▼
Cached/validated Quran content (static JSON + CDN, edge-cached)
        │
        ▼
apps/quran  (Next.js — SSR/SSG reader, PWA shell)
        │
        ├── User data (bookmarks, progress, prefs) ──► new Supabase project (Postgres, minimal schema)
        │       optional auth, anonymous-first (localStorage) by default
        │
        └── Audio ──► reciter CDN, streamed directly, never proxied through our servers
```

This mirrors the master prompt's own architecture (§8, §39): the Quran text/translation/audio itself is treated as **immutable reference content**, decoupled from live API calls and decoupled from user-specific data. A visitor should never wait on, or be blocked by, a third-party API being slow or down (§42).

## 2. Decision: independent app, independent infra

**Decision:** `apps/quran` is a new, independent Next.js app inside the existing monorepo — its own `package.json`, own Supabase project, own Vercel project, own CI job. It does not import from or depend on `apps/web`.

**Alternatives considered:**
- Add Quran-reading routes directly into `apps/web`. Rejected — different audience (public/anonymous vs. authenticated tutor-student), different auth model, different privacy posture (minors' PII lives in `apps/web`'s DB; this product should not need to touch that data at all), different deploy cadence and risk profile. Mixing them raises the blast radius of any RLS mistake and couples two products' release cycles for no benefit.
- Turborepo/pnpm workspaces with a shared UI/config package. Rejected for now — two apps sharing zero runtime code today doesn't justify workspace tooling the rest of this repo doesn't use (KISS, §41). Revisit only if real duplicated code becomes a maintenance problem.

**Reason:** matches how `apps/web` itself is already structured (fully self-contained app, root `package.json` just delegates via `--prefix`), and keeps the two products able to fail, scale, and deploy independently.

**Cost impact:** $0 — a second Vercel project and a second Supabase project are both free-tier at this scale. **[NEEDS VERIFICATION: current Supabase free-tier project-count limit per organization]** before assuming a second free project is available without any plan change.

**Future impact:** fully reversible — nothing in this design prevents later consolidation (e.g. a shared design-tokens package) if it ever earns its complexity.

## 3. Frontend

- **Framework:** Next.js (App Router) + React + TypeScript — same major-version family as `apps/web` (currently Next 16 / React 19) for consistency of developer knowledge in this repo, re-verified against current stable releases at scaffold time.
- **Styling:** Tailwind CSS. A **new**, purpose-built design-token set (not imported from `apps/web`) — same *methodology* (CSS custom properties, class-based dark mode, `next/font/google` for Amiri/Arabic + a calm Latin pair) but tuned for a reading surface, not a dashboard. Reader typography (Arabic size, translation size, line-height, reading width) are runtime-adjustable tokens, not hardcoded (§11).
- **Rendering strategy:** Surah/Juz/Page routes are statically generated (SSG) at build time where content is stable, with ISR revalidation on a schedule (e.g. daily) to pick up sync-layer updates — first paint of Quran text should never wait on a client-side fetch (§19, §22 SEO).
- **PWA:** installable manifest + service worker (offline app shell first; offline Quran text/translation is a later phase, §20) using a minimal, standard approach (Web App Manifest + Workbox-generated SW) rather than a heavy framework-specific plugin, to stay portable if the framework changes later.
- **i18n:** route-based locale segments (`/[locale]/...`), starting with `ar` (RTL) and `en` (LTR), using Next's built-in i18n routing + a lightweight message-catalog library — chosen over a heavier CMS-backed i18n system per §21/§41 (no UI string hardcoded directly in components).

## 4. Quran content: provider, sync, caching

**Decision:** the Quran Foundation Content APIs (`api-docs.quran.foundation`, content API v4.0.0 — the current home of what was `api-docs.quran.com`) are the confirmed content source. Phase 0's research task is complete — see [`QURAN-CONTENT.md`](./QURAN-CONTENT.md) for the full authentication model, licensing terms, and sources. Everything below reflects that research, including one correction it forced on this document's earlier draft (the cadence point below).

**Sync/cache pipeline:**
- A small, separate sync script (not part of the request path) authenticates via OAuth2 client-credentials, pulls Surah/Ayah text, selected translation(s), Juz/Page/Hizb/Ruku metadata, and reciter/audio manifests from the API, validates it, and writes it to a static content store (versioned JSON, one bundle per locale/content-type) checked into build output or an object store — not queried live per request.
- The running app reads only from this cache/CDN layer. If the upstream API is unreachable, the app is **unaffected** — it was never in the request path (§42, "failure handling").
- **Revalidation cadence is a license requirement, not a convenience:** Quran Foundation's terms cap cached/stored content at **1 week maximum** unless re-synced at least every 7 days (`QURAN-CONTENT.md` §3). The sync job therefore must run **at least weekly, automatically** (e.g. a scheduled GitHub Actions workflow that re-runs the sync script and redeploys, or an ISR revalidation window ≤ 7 days) starting from Phase 1 — this is a correction to an earlier draft of this document, which had deferred scheduling to a later hardening phase. Running it more often (e.g. daily) is fine and simpler to reason about than cutting it close to the 7-day limit.

**Alternatives considered:**
- Store full Quran text in Postgres and query it per page request. Rejected as the default — this is large, effectively immutable content; static/CDN caching is both cheaper and faster than a DB round trip on every read (§8 explicitly warns against this).
- Call the content API directly from the browser per page view. Rejected — couples every visitor's experience to a third party's uptime/latency and rate limits, and risks leaking any API credential that isn't meant for the browser (§7.9).

**Reason:** resilience and performance are named as the two highest priorities (§19, §42); a static/CDN-first design satisfies both and costs nothing extra.

**Cost impact:** $0 at this scale — static assets on Vercel's CDN or a Cloudflare-fronted bucket are within any relevant free tier.

**Future impact:** fully reversible — a future move to a different provider only touches the sync script and its output format, not the app's read path.

**Translations:** only verified, properly licensed translations are used, matching whatever the chosen provider serves with attribution — never machine-translated (§7, explicit "critical rule"). Attribution requirements per translation are recorded in `QURAN-CONTENT.md` once the provider research is done (Phase 0 deliverable, not yet written).

## 5. User-specific data (bookmarks, progress, prefs)

**Decision:** a small, separate Postgres schema in the new Supabase project — only what the master prompt actually lists (§25): bookmarks, reading progress, reading history, preferences, notes (future), collections (future). No table is created ahead of a genuine feature needing it.

- **Anonymous-first:** bookmarks, last-read position, and reader preferences (font size, theme, translation visibility) are stored in the browser (`localStorage`/IndexedDB) by default — reading, listening, searching, and adjusting the reader all work with zero account (§9). This is also why the *content* layer above must never require auth.
- **Optional sync:** signing in (Phase 5) upgrades local data to server-synced rows tied to the user, for cross-device continuity — not a prerequisite for using the app.
- **RLS:** every table denies-by-default; a user can only read/write their own rows. Same pattern already proven in this repo (`apps/web`'s `STABLE SECURITY DEFINER` helper-function convention for non-recursive RLS) is worth reusing *as a pattern*, not as shared code across projects.

**Alternatives considered:** requiring an account for any personalization. Rejected outright — directly contradicts §9's explicit requirement that reading never requires signing in.

**Cost impact:** $0 — bookmarks/progress/prefs are tiny rows; Supabase's free Postgres tier (verify current allowance at build time) comfortably covers this at pilot scale.

## 6. Search

**Decision:** start with Postgres full-text search (`tsvector`/`tsquery`) over the cached Arabic text and English translation, or, if search volume is small enough, a client-side indexed search (e.g. a prebuilt lightweight index shipped with the static content bundle) — whichever proves fast enough in Phase 3, decided with a measurement, not a guess.

**Alternatives considered:** Elasticsearch/Algolia. Explicitly rejected per §14 ("do not introduce Elasticsearch merely because it is available") and §6 (avoid unnecessary paid services) — revisit only if real search-latency numbers demand it.

**Cost impact:** $0 either way at this scale.

## 7. Audio

**Decision:** stream reciter audio directly from an existing, licensed audio CDN rather than hosting/storing audio files ourselves. Candidate sources to evaluate in Phase 0/2 research (not yet chosen): the audio CDN Quran.com's own API references, or another established reciter-audio host — chosen based on licensing clarity and bandwidth cost, mirroring the existing repo's own precedent of "reference, don't copy" for large media (§13, §39 "Quran Content / Audio Services" as an explicit external box in the target architecture diagram).

**Reason:** avoids any self-hosted bandwidth or storage cost for audio, which would otherwise be the single largest cost driver of this product (§13: "Audio should not unnecessarily consume application server bandwidth").

## 8. Hosting, CI/CD

- **Hosting:** Vercel, new project, Hobby (free) tier — genuinely compliant here (unlike the existing tutoring app) since this product is explicitly non-commercial/free-for-users, which is exactly what Vercel's Hobby ToS permits.
- **CI/CD:** a path-filtered addition to (or a second file alongside) `.github/workflows/ci.yml`, scoped to `apps/quran/**`, so this app's pipeline is fully independent of the tutoring app's — a break in one never blocks or redeploys the other. Same `validate` (lint/typecheck/build) → `deploy` (Vercel CLI, prebuilt, prod) → health-check shape as the existing workflow, since it's already proven in this repo.
- **Environments:** `development` (local), `preview` (per-PR Vercel preview deploys), `production` — per the master prompt's explicit naming rule (§30: "do not use confusing environment names such as 'pilot' for the production deployment environment").
- **Domain — decided:** `iqraspace.org/quran` (a path under the main IqraSpace domain, not a subdomain). This means `apps/quran` is not the only thing served from `iqraspace.org` — something else owns the domain root, and this app owns only the `/quran` path.

  **What owns the root — decided 2026-08-31, during the production deployment pass:** a new, minimal, independent static site, `apps/landing` — a single page (brand wordmark, tagline, one link into `/quran`), its own Vercel project, no framework/build step (deliberately — nothing here justifies one). It performs the Multi-Zones rewrite described below. See `apps/landing/vercel.json` and `DEPLOYMENT.md`. This was chosen over the two other options on the table (the tutoring app owning the root; a future ecosystem hub per Readme.md §40 owning it) because both would have blocked getting `iqraspace.org` live now on work that doesn't exist yet — `apps/landing` can be replaced by either later without apps/quran changing at all, since the rewrite is the only thing that points at it.

  **How this gets wired up (Next.js Multi-Zones — do this when the Vercel project is created, not before):** `apps/quran` stays a fully independent app/deployment (per §2 — this decision doesn't change that), but is configured with `basePath: '/quran'` so every route, link, and static asset it generates is automatically prefixed. Whatever serves `iqraspace.org`'s root then adds a rewrite (`rewrites()` in its own `next.config`, or a `vercel.json` rewrite) sending `/quran/:path*` to this app's deployment URL. Each app keeps deploying independently — this is a routing-layer stitch, not a merge.

  **Prepared now, low-risk:** `next.config.ts` reads `basePath` from `NEXT_BASE_PATH`, defaulting to unset. Local dev and this repo's CI build are unaffected today (the env var isn't set anywhere yet); the production Vercel project, once created, sets `NEXT_BASE_PATH=/quran` and nothing else in the app needs to hardcode the `/quran` prefix — Next.js's own `<Link>`/asset handling does it automatically. This is intentionally the only piece of domain wiring done ahead of time (§37 — avoid building infrastructure that has nothing to attach to yet); the rewrite on the domain-root side, and the Vercel project itself, are done when that project actually exists.

## 9. Security & privacy posture

- No secrets in the browser beyond what's genuinely public (Supabase URL + anon/publishable key — safe by RLS design, same posture the existing app already uses correctly).
- Any content-provider API key (if the chosen provider requires one) is used only server-side (sync script / server component), never shipped to the client (§7.9).
- RLS on every user-data table from day one, deny-by-default, narrow allow policies added as features land — same discipline `apps/web`'s migration history already demonstrates.
- Minimal data collection throughout (§28): no tracking beyond what's needed to know the app works (errors, performance, aggregate popular-Surah counts) — no advertising profiles, ever.

## 10. What's deliberately deferred

Per §37 (avoid feature creep), the following are named in the master prompt but explicitly **not** part of the initial architecture — recorded here so they're tracked, not forgotten:

- Google Drive/Calendar-style third-party integrations — not applicable to this product at all.
- Tajweed-aware color annotations, memorization tools, offline audio downloads, multi-tutor concepts — none of these apply; this is a reading product, not the tutoring product.
- A full CMS/admin panel — only build the minimum needed to operate (e.g. re-run content sync, see basic error/usage stats), per §26.
- Elasticsearch, Kubernetes, microservices, Redis, paid monitoring — none justified at any scale discussed in `COST.md`.
