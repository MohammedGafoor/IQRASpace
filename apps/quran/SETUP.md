# Setup — IqraSpace Quran

> Read. Listen. Learn. Reflect.

A free, fast, distraction-free Quran reader — no account required. This file is the practical dev-setup guide; see [`Readme.md`](./Readme.md) for the full product brief (the master prompt this app is being built from).

*(Named `SETUP.md`, not `README.md` — this filesystem treats `README.md` and `Readme.md` as the same file, which would collide with the master prompt above. Don't add a `README.md`/`readme.md` here for the same reason.)*

**Start here:**
- [`PROJECT-STATUS.md`](./PROJECT-STATUS.md) — current state, risks, what's decided vs. still open
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — technical architecture and the reasoning behind it
- [`PRODUCT-ROADMAP.md`](./PRODUCT-ROADMAP.md) — phases and exit criteria
- [`COST.md`](./COST.md) — infrastructure cost at every stage
- [`QURAN-CONTENT.md`](./QURAN-CONTENT.md) — content provider, licensing, and the sync/caching rules that come with it

## Stack

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 — a fully independent app from `apps/web` (this monorepo's other, unrelated tutoring product): own `package.json`, own Supabase project (not yet provisioned), own Vercel project (not yet provisioned). See `ARCHITECTURE.md` §2 for why.

## What's here today

Phase 1 (Core Quran Reader) is underway and real, not a scaffold — see `PRODUCT-ROADMAP.md`'s Phase 1 "Status" section for exactly what's built vs. still open. The full Quran (114 Surahs, 6,236 verses) is synced from production; Surah/Juz/Mushaf-page navigation, reader controls, local bookmarks, and Continue Reading all work end to end.

## Local setup

```bash
npm install --prefix apps/quran     # from the repo root, or:
cd apps/quran && npm install

cp .env.local.example .env.local
# QURAN_FOUNDATION_CLIENT_ID / _SECRET: register at
# https://dev-console.quran.foundation/projects (see QURAN-CONTENT.md §5) —
# an account-creation step only the project owner can do. Nothing here
# will fetch real content until these are set.

npm run dev      # http://localhost:3001 (port 3001, not 3000 — apps/web
                  # already uses 3000; both can run side by side locally)
```

Once credentials are set:

```bash
npm run sync:content   # fetches the full Quran (114 Surahs, 6,236 verses),
                        # writes src/content/generated/ (gitignored) —
                        # ~115 paced API requests, a couple of minutes
```

## Branding assets — done

The real logo (`public/brand/logo.png`, the full lockup — the one canonical file every generated brand image reads from, see `lib/branding/logo.ts`) is in the repo. Since this environment has no image-editing library (no `sharp`, no ImageMagick), every generated brand image is produced at build time via `next/og`'s `ImageResponse` instead of a static export:

- `src/app/icon.tsx` / `apple-icon.tsx` — crop the source down to just the book+tower+star mark (the "IQRA SPACE" wordmark is illegible at favicon sizes) using a CSS-`object-fit: contain`-style fit so nothing clips.
- `src/app/opengraph-image.tsx` — uses the full lockup (mark + wordmark + tagline), legible at social-share size, framed on the app's ivory background.
- `src/app/page.tsx` (the homepage) shows the full logo directly via `next/image` — no cropping needed there.
- `src/app/brand/book-icon/route.tsx` / `candle-icon/route.tsx` — the book and candle elements cropped separately, built for a homepage feature-icon section that was later removed (see `PRODUCT-ROADMAP.md`'s Phase 1 status) — currently unused, kept in case they're wanted elsewhere. Getting these two working surfaced a real Satori (next/og's renderer) bug — documented in `renderCroppedIcon.tsx` — worth reading before touching this code again.
- `public/manifest.webmanifest` references `/icon` and `/apple-icon` directly (Next serves these routes at stable paths). A dedicated 192×192 export would be worth adding once real PWA installability testing happens (Phase 6) — 180×180 (`apple-icon`) is close but technically under Chrome's 192px minimum.

If the logo file is ever replaced, re-measure `LOGO_ICON_CROP` in `lib/branding/logo.ts` against the new file's actual proportions — it's hand-measured against this specific artwork, not derived automatically.

## Supabase (user data only — bookmarks, progress, preferences)

Reading, listening, searching, and bookmarking on one device all work with **zero** Supabase project configured — everything is local-first (`ARCHITECTURE.md` §5). This project only matters once cross-device sync (Phase 5) is being built.

```bash
# From apps/quran, once a new (separate — not the tutoring app's) Supabase
# project exists (PROJECT-STATUS.md §7):
npx supabase link --project-ref <your-project-ref>
npx supabase db push        # applies supabase/migrations/0001_init_schema.sql
```
