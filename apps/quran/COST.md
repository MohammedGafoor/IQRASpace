# COST — IqraSpace Quran

> **Freshness note (copied deliberately from this repo's own precedent in `Iqra-space-architecture.md`):** free-tier limits, ToS clauses, and pricing for Vercel, Supabase, Cloudflare, and any Quran content/audio API change often. Every figure below is a scale-relative estimate, not a verified current number — re-check each provider's live pricing/limits page before relying on any of them, especially the ones marked **[VERIFY]**.

Every paid service follows the master prompt's required format (§6): purpose, estimated usage, estimated monthly cost, free/cheaper alternative, reason it's necessary. Nothing below is paid at pilot scale.

## 1. Infrastructure at pilot scale (target: first real public users, order of hundreds–low thousands)

| Service | Purpose | Estimated usage | Tier | Estimated cost | Notes |
|---|---|---|---|---|---|
| Vercel | Hosting, **two** projects: `apps/quran` (the reader, everything under `/quran`) and `apps/landing` (a single static page owning `iqraspace.org`'s root, added 2026-08-31 — `ARCHITECTURE.md` §8) | Static/SSG pages, moderate traffic | Hobby (free), both projects | $0 | Genuinely ToS-compliant — this product is free/non-commercial by design, unlike the paid tutoring app. `apps/landing` adds no cost of its own: a static page with no build step is the cheapest possible Vercel deployment. **[VERIFY]** current Hobby bandwidth/build-minute limits, and whether two Hobby projects under one account is unrestricted (expected yes — no stated limit on project *count*, only usage). |
| Supabase (new project) | Bookmarks, reading progress/history, preferences, notes | A few MB of small rows even at thousands of users | Free | $0 | Content itself is *not* stored here (see `ARCHITECTURE.md` §4) — this project only ever holds small, per-user rows. **[VERIFY]** current free Postgres size / MAU limits and whether a second free Supabase project per org is still permitted. |
| Quran content API (candidate: Quran Foundation / Quran.com) | Source of Quran text, translations, audio metadata — pulled by the sync layer, not per-request | One sync run per content update, not per visitor | Free (public API) | $0 | **[VERIFY]** as Phase 0's first task: current auth model, rate limits, and licensing terms for a free/non-commercial site — not yet confirmed at all. |
| Reciter audio CDN | Serves actual audio bytes to visitors' browsers directly (never proxied through our servers) | Scales with listeners, not with our infra | External, not billed to us | $0 | This is the one line item that would otherwise dominate cost if self-hosted — deliberately avoided (`ARCHITECTURE.md` §7). |
| CDN/DNS (Cloudflare) | Optional — only if a custom domain is chosen and extra caching/DNS control is wanted | N/A until a custom domain exists | Free | $0 | Not required if the app stays on a `*.vercel.app` alias. |
| Domain name | Optional, only if a custom domain is chosen (per `ARCHITECTURE.md` §8, an open decision) | 1 domain/year | N/A | ~$10–20/year | The one plausible real, non-infra cost — a deliberate choice, not a requirement. |
| Monitoring | Uptime/error tracking | Low volume | Free tier of an existing tool (e.g. Vercel's built-in analytics, or a free uptime checker) | $0 | No paid monitoring justified at this scale (§27). |

**Total at pilot scale: $0/month**, plus an optional ~$10–20/year if a custom domain is chosen. This matches the master prompt's "$0/month development, free tiers for pilot" target (§6) exactly.

## 2. Alternatives considered (for the record, per §6's required format)

| Decision | Free/cheaper option | Chosen | Why |
|---|---|---|---|
| Frontend hosting | Cloudflare Pages, Netlify, GitHub Pages | Vercel | Matches this repo's existing tooling/knowledge (already used by `apps/web`); Hobby tier is genuinely appropriate here (non-commercial). Netlify/Cloudflare Pages remain valid fallbacks if Vercel limits are ever hit. |
| Backend/DB | Firebase/Firestore, a self-hosted Postgres | Supabase | Relational model fits bookmarks/progress naturally; free tier bundles Auth + Postgres + RLS in one place; same reasoning the existing app's own architecture doc already used and validated in production. |
| Search | Elasticsearch/Algolia | Postgres full-text or a shipped client-side index | Explicitly avoided per §14 until real usage numbers justify more. |
| Audio hosting | Self-hosted storage + our own bandwidth | External reciter CDN | Removes the single largest potential cost driver entirely; standard practice for Quran apps. |

## 3. Expected scaling (per §38 — explain, don't pre-build for it)

| Users | What changes | Action needed now |
|---|---|---|
| 1,000 | Negligible load on any layer above. Content is CDN-cached; user-data rows are tiny. | None. |
| 10,000 | Still comfortably inside every free tier **[VERIFY at the time]** — Supabase row counts stay small (bookmarks/prefs, not content), Vercel bandwidth is mostly cached static/ISR responses. | Watch Vercel bandwidth and Supabase connection counts; no architecture change. |
| 100,000 | First point where a free-tier ceiling is plausible — most likely Vercel bandwidth (if a custom domain isn't already fronted by a CDN with better caching) or Supabase's free Postgres/connection limits from a larger authenticated-sync user base (Phase 5+). Reciter audio bandwidth is still not our cost (external CDN). | Re-run the cost analysis with real traffic numbers before upgrading anything; likely first upgrade is Vercel Pro (~$20/month) or fronting more aggressively with Cloudflare caching — not a database or hosting migration. |
| 1,000,000 | Would need a real capacity/cost review with actual measured traffic, not a projection made today. Likely candidates: a paid Vercel/CDN tier, possibly a larger Supabase tier if authenticated sync usage is high — still no justification foreseeable today for Kubernetes, microservices, Elasticsearch, or self-hosted audio at this scale, since the content-serving path stays CDN-shaped regardless of user count. | Do not pre-build for this now (§38 explicit instruction) — revisit only once 100k-scale numbers are real. |

## 4. What's deliberately not budgeted for

Per §6's explicit "do not introduce" list: no Kubernetes, no microservices, no dedicated servers, no expensive/managed search, no Redis, no paid CMS, no expensive monitoring, no unnecessary third-party APIs, and no AI APIs for basic Quran functionality (text/translation/audio/search/bookmarks need none of this). Any future proposal to add one of these must come with the full decision/alternatives/reason/cost table this document uses, per §33.
