# QURAN-CONTENT — Provider, Licensing, Sync Strategy

Phase 0 research task from [`Readme.md`](./Readme.md) §7 and the open item flagged in [`PROJECT-STATUS.md`](./PROJECT-STATUS.md) §5.4. Findings below are sourced directly from the current Quran Foundation documentation site (checked 2026-08-31) — cited inline, not recalled from training data, since API surfaces and licensing terms drift (per this repo's own precedent in `Iqra-space-architecture.md`'s freshness note).

**Bottom line: the provider is confirmed usable for this product, in production, with a real architectural correction along the way (sync cadence, §3) and the full Quran (114 Surahs, 6,236 verses) already synced and rendering — see §4b.**

## 1. Chosen provider

**Quran Foundation Content APIs** (`api-docs.quran.foundation`, the successor/canonical home for what used to be documented at `api-docs.quran.com` — both hostnames currently resolve to the same docs portal), currently at **content API version 4.0.0**.

Relevant endpoint categories confirmed available: Chapters (Surah list/info), Verses (multiple script variants including Uthmani, plus word-by-word and per-verse audio URLs), Translations, Tafsirs, Audio/Recitations, Juz, Hizb, Rub el Hizb, Ruku, Manzil, Pages, Resources (reciter/translation metadata), Quran (misc.), Footnote — this covers every content type the master prompt's §7 checklist asks for (Surahs, Ayahs, Juz, Pages, Hizb, Ruku, Translations, Tafsir, Recitations, Audio, Search, Metadata), with the possible exception of a dedicated full-text **Search** endpoint, which was not confirmed in this pass and needs a direct check against the "Quran" or "Resources" category before Phase 3 (search) is architected — do not assume it exists yet.
([Content APIs](https://api-docs.quran.foundation/docs/category/content-apis/), [By Chapter](https://api-docs.quran.com/docs/content_apis_versioned/4.0.0/verses-by-chapter-number/))

There is also a separate **User-related APIs** product (OIDC-based, per-end-user login into a Quran Foundation account) offering bookmarks, notes, goals, streaks, and reading sessions. **Deliberately not adopted** for this product's user-data layer — see the decision in §4.

## 2. Authentication

- **Flow:** OAuth2 **Client Credentials** grant (server-to-server, no end-user login involved) — the correct choice for the anonymous-first, non-personalized part of this app (reading Quran text/audio needs no per-user identity at all).
- **Registration:** create a project in the [Developer Console](https://dev-console.quran.foundation/projects) to obtain a `client_id` and a **one-time** `client_secret` (store it immediately — it is not retrievable again). New apps start in **pre-live** status; production traffic requires Quran Foundation's approval before go-live.
- **Token request:** `POST /oauth2/token` with Basic auth (client_id/client_secret) and `grant_type=client_credentials&scope=content`. Returns an `access_token` valid for `3600` seconds. **There is no `refresh_token`** in this flow — request a fresh token proactively before expiry (the docs' own recommendation: cache the token, re-request when close to expiry).
- **Per-request headers:** every Content API call needs both `x-auth-token` (the access token) and `x-client-id`.
- **Server-side only:** the client secret must never reach the browser — token acquisition belongs in the sync script / a server-only module, never a client component, consistent with `ARCHITECTURE.md` §9.
- **Environments — separate hostnames, not a header/query flag:**

  | | Auth (token) host | Content API host |
  |---|---|---|
  | Pre-live (new apps start here) | `https://prelive-oauth2.quran.foundation` | `https://apis-prelive.quran.foundation` |
  | Production (after go-live approval) | `https://oauth2.quran.foundation` | `https://apis.quran.foundation` |

  Content requests are `GET {api-host}/content/api/v4/{resource}` (e.g. `/content/api/v4/chapters`). `src/lib/quran-api/client.ts` picks the host pair from a single `QURAN_FOUNDATION_ENV=prelive|production` value (defaulting to `prelive`, since that's every new app's starting status) rather than hardcoding one.

([Quick Start Guide](https://api-docs.quran.com/docs/quickstart/), [qf-api-docs quickstart source](https://github.com/quran/qf-api-docs/blob/main/docs/quickstart/index.md))

## 3. Licensing — and the one correction this forces on `ARCHITECTURE.md`

From the [Developer Terms of Service](https://api-docs.quran.foundation/legal/developer-terms/):

- **Permitted use:** a non-exclusive, revocable, non-transferable license to use the APIs to build applications giving "beneficial Quranic experiences." A **free, non-commercial app is squarely inside this license** — no special agreement needed. Monetizing an app that uses the content (subscriptions, ads, donations) is also explicitly allowed, though not relevant to this NGO-style, ad-free product.
- **Text integrity:** the Quran text must never be modified/altered, and excerpts must not be arranged or displayed in a way that misrepresents the original meaning — directly matches the master prompt's own "never machine-translate or alter Quran text" rule (§7).
- **No redistribution as a standalone product:** the raw content/API data cannot be resold, sublicensed, or redistributed outside the context of an actual application. Any commercial *redistribution* of the raw content itself (not just an app using it) needs a separate written license — not something this project needs.
- **Rate limits:** the terms require compliance with "published rate limits or quotas," but **the concrete numbers are not public** in the docs pages reviewed — Quran Foundation's own FAQ describes unpublished specifics as confidential, obtainable only once an app is registered (or via their support channel). **[NEEDS VERIFICATION once a project is registered — do not hardcode an assumed request budget into the sync script; build it with backoff/retry regardless of the number.]**
- **Caching/storage limit — this is the one finding that changes the architecture:** QF Content may be **cached or stored for a maximum of 1 week**, unless (a) QF has expressly permitted longer storage, or (b) the content is obtained through the **Content Sync APIs**, which permit longer/offline storage on the condition that the app performs a re-sync **at least every 7 days**.

  **Correction to `ARCHITECTURE.md` §4:** that document originally described the sync cadence as "manual/on-demand... a scheduled job is a later hardening item." That is **not compliant** with this license term as written — the sync job must run **at least weekly, automatically**, from Phase 1 onward, not deferred to a later phase. This is a small change in practice (a GitHub Actions scheduled workflow re-running the sync script and redeploying, or an ISR revalidation window ≤ 7 days) but it's a hard constraint, not a nice-to-have. `ARCHITECTURE.md` §4 has been updated to reflect this.

- **Attribution:** no explicit mandatory "display the Quran Foundation logo" clause was found in the sections reviewed. As a low-risk default, the app will still show a simple, honest credit ("Quran text and data provided by the Quran Foundation") on a content-attribution page, per the master prompt's own §23/§28 requirement to document and disclose content sources regardless of what's strictly mandated. **Re-read the full terms page directly (only key sections were reviewed via automated fetch) before public launch**, and check each **Translation** resource's own metadata via the API — translations typically carry their own translator/publisher attribution string that must be surfaced per-translation, not replaced by a single generic credit line.

## 4. Decision: content via QF Content APIs, user data stays ours

**Decision:** use the Quran Foundation Content APIs (client-credentials, server-side sync) as the sole source for Quran text/translations/audio/navigation metadata. Do **not** use QF's User-related APIs / OIDC login for bookmarks, notes, progress, or streaks.

**Alternatives considered:** adopting QF's own User APIs would remove the need to design and host any user-data schema ourselves.

**Reason for declining:** it would require every personalizing feature (even a single bookmark) to authenticate through a third party's identity system, which directly conflicts with the master prompt's explicit requirement that reading, and the light personalization around it, work with **no account at all** by default (§9) — QF's OIDC user model has no "anonymous, local-device" mode. Keeping our own minimal Supabase schema (per `ARCHITECTURE.md` §5) preserves full control over the anonymous-first UX and avoids a second identity system users would have to trust.

**Cost impact:** $0 either way — noted for completeness, not because cost drove the decision.

**Future impact:** fully reversible — nothing prevents later offering "sign in with Quran Foundation" as one more optional auth provider alongside our own, if that's ever useful.

## 4a. Verified live, against real pre-live credentials (2026-08-31)

Phase 0's sync proof-of-concept (`scripts/sync-content.mjs`) has been run successfully end to end against a real, registered pre-live project — not just read about. Two things learned by testing, not documented anywhere in the docs pages reviewed in §1-3:

- **Verse text is opt-in, not default.** `GET /verses/by_chapter/{n}` returns only navigation metadata (juz/page/hizb/ruku numbers) unless the request includes `fields=text_uthmani` (confirmed via the endpoint's real query-parameter table — [source](https://github.com/quran/qf-api-docs/blob/main/docs/content_apis_versioned/4.0.0/verses-by-chapter-number.api.mdx)). Same for translations: `translations=<id>` embeds a `translations` array per verse, but only for an id that actually exists in the current environment's dataset.
- **Pre-live is a small sandbox dataset, not a production mirror — do not assume otherwise.** `GET /resources/translations` against this registered pre-live project returned only **14 translations total, 2 of them English**: id `85` ("M.A.S. Abdel Haleem") and id `57` ("Transliteration"). An id that doesn't exist in the current dataset (tried: `131`, "Dr. Mustafa Khattab, The Clear Quran" — a real, commonly-used translation, just not present here) is **silently ignored** — no error, no empty array, the `translations` key simply never appears. This is an easy trap: a missing translation can look like a client bug when it's actually just an absent resource in this environment. The proof-of-concept script now uses id `85`, confirmed present. **Re-check the full translation catalog (and reconsider which translation(s) to actually ship) once production access is granted** — pre-live's 14-translation dataset should not be treated as the real available set.
- Chapter metadata (`GET /chapters/1`) and reciter/recitation resources (`GET /resources/chapter_reciters`, `GET /resources/recitations`) all responded normally in pre-live with real data (e.g. reciter id `7`, Mishari Rashid al-`Afasy) — worth spot-checking the same way before Phase 2 (Audio) is built, rather than assuming every resource category is fully populated in pre-live.
- **This pre-live project's sandbox contains only 2 of the 114 Surahs — Al-Fatihah and Al-Baqarah.** `GET /chapters` returns exactly those two; `GET /chapters/3` through `/chapters/114` all return `404` with the (misleadingly generic) message *"Surah number or slug is invalid. Please select valid slug or surah number from 1-114"* — confirmed directly, not inferred from a count mismatch alone. **This is the single biggest practical constraint on this app today**: the full-catalog sync (`npm run sync:content`) can only ever produce these 2 Surahs until production access is granted. Every Phase 1 page in this app is built to read however many Surahs actually exist in the synced content (currently 2), not a hardcoded 114 — so nothing needs to change in the app itself once production access unlocks the rest; re-running the sync is the only step required.

A real end-to-end sample (`src/content/generated/al-fatiha.json`, gitignored, regenerate with `npm run sync:content`) now contains genuine Uthmani Arabic text and a genuine Abdel Haleem translation for all 7 verses of Al-Fatiha, fetched live through this project's own credentials.

## 4b. Production access granted and verified (2026-08-31)

Production credentials (`QURAN_FOUNDATION_PROD_CLIENT_ID`/`_SECRET`, `QURAN_FOUNDATION_ENV=production`) are live. Verified directly, not assumed:

- `GET /chapters` returns all **114** chapters.
- `GET /resources/translations` returns **144** translations, **8 of them English**: Abdel Haleem (`85`, already in use — still present, kept as the default), Usmani (`84`), Maududi/Tafhim (`95`), Pickthall (`19`), Yusuf Ali (`22`), Saheeh International (`20`), Al-Hilali & Khan (`203`), Transliteration (`57`). Pre-live's earlier 2-English/14-total dataset was indeed just a small sandbox, exactly as flagged in §4a — confirmed, not merely predicted.
- A full sync (`npm run sync:content`, ~114 chapter+verse requests, paced at 250ms with retry/backoff) completed cleanly against production with **zero rate-limit (429) responses** — the "unpublished limit" from §3 didn't bite at this request volume, but the pacing/backoff logic stays in place since the real number is still unconfirmed by Quran Foundation support.
- Result: `src/content/generated/` now holds all **114 Surahs, 6,236 verses** — every verse count matches the chapter metadata's own `verses_count` exactly (checked programmatically, not spot-checked). The app rebuilds to **118 static pages** (114 Surah readers + list + home + 404) and was smoke-tested end to end: `/surah` lists all 114, `/surah/114` (last Surah) and `/surah/2` (286 ayahs) both render correctly, `/surah/115` (out of range) correctly 404s.

Both pre-live and production credentials are kept side by side in `.env.local` (see `.env.local.example`) — `QURAN_FOUNDATION_ENV` switches between them without losing either.

**Still outstanding, unchanged by this milestone:** the real numeric rate limit (ask Quran Foundation support), and reviewing the full Developer Terms of Service end to end before public launch (§5).

## 5. Action items only the project owner can complete

1. ~~Create a Quran Foundation developer account and register a project~~ — **done**, verified against pre-live (§4a).
2. ~~Request production/go-live approval~~ — **done, 2026-08-31**: production credentials live and verified (§4b), full 114-Surah/6,236-verse sync completed.
3. Read the full Developer Terms of Service end-to-end (this document reviewed key sections via automated fetch, not the complete legal text) and confirm they're comfortable with them for a public NGO-style deployment — still outstanding, worth doing before public launch.
4. Ask Quran Foundation support (contact listed in their docs) for the actual numeric rate limits — the full sync ran clean with zero 429s at this volume (§4b), but the real published number is still unconfirmed.

## Sources

- [Quick Start Guide](https://api-docs.quran.com/docs/quickstart/)
- [Content APIs (category)](https://api-docs.quran.foundation/docs/category/content-apis/)
- [Verses — By Chapter](https://api-docs.quran.com/docs/content_apis_versioned/4.0.0/verses-by-chapter-number/)
- [Quran Foundation Developer Terms of Service](https://api-docs.quran.foundation/legal/developer-terms/)
- [Frequently Asked Questions](https://api-docs.quran.com/docs/tutorials/faq/)
- [User-related APIs](https://api-docs.quran.foundation/docs/user_related_apis_versioned/1.0.0/user-related-apis/)
