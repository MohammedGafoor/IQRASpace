import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Same monorepo layout as apps/web (see /package.json) — pin Turbopack's
  // root here so it doesn't get confused by the repo-root package-lock.json
  // one level up.
  turbopack: {
    root: path.join(__dirname),
  },

  // Domain is decided (ARCHITECTURE.md §8): iqraspace.org/quran, served via
  // a Next.js Multi-Zones rewrite from whatever owns the domain root, once
  // this app's own Vercel project exists. Until then NEXT_BASE_PATH is
  // unset everywhere (local dev, this repo's CI build) and this is a no-op
  // — set NEXT_BASE_PATH=/quran only in that future production
  // environment's config. Do not hardcode "/quran" anywhere else in the
  // app; Next's own routing/<Link>/asset handling picks this up
  // automatically once set.
  basePath: process.env.NEXT_BASE_PATH || undefined,

  // Security headers (objective: "Missing appropriate security headers").
  // Source paths are automatically prefixed with basePath by Next itself,
  // same as rewrites/redirects, so "/:path*" already covers "/quran/*" in
  // production without repeating the prefix here.
  //
  // style-src allows 'unsafe-inline': this codebase uses React inline
  // `style={{...}}` extensively (AyahBlock, reader toolbar, nav, etc.) —
  // rewriting all of it to CSS classes would be a real redesign, out of
  // scope for a deployment pass. Inline *styles* (not scripts) are a much
  // lower-risk CSP relaxation than allowing inline/eval'd script.
  //
  // script-src ALSO needs 'unsafe-inline' — this was the real root cause
  // of "nothing on the reader page is clickable" (zoom, translation
  // checkboxes, bookmark, Go-to-Ayah — every control, in both `next dev`
  // and the production build). The App Router inlines small bootstrap
  // <script> tags with no `src` (RSC flight data via
  // `self.__next_f.push(...)`, plus a dev-only debug-channel script) to
  // hydrate the page — without them the client never attaches ANY event
  // listeners. `script-src 'self'` with no 'unsafe-inline'/nonce/hash
  // silently blocked those (confirmed via a real browser: a CSP
  // violation console error plus, in prod, a hydration-failure React
  // error). The alternative — nonce-based CSP — requires forcing every
  // route to dynamic rendering (Next's own CSP guide,
  // node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
  // §"Static vs Dynamic Rendering with CSP"), which would break this
  // app's 759 statically-generated routes. Next's own docs give
  // `script-src 'self' 'unsafe-inline'` as the standard, supported
  // pattern for exactly this case (static generation, no nonces) — same
  // trade-off already accepted for style-src above. 'unsafe-eval' is
  // dev-only, added per the same guide's dev note (React reconstructs
  // server error stacks via eval in development only — production uses
  // neither React nor Next's eval). Nothing here allows a *third-party*
  // script origin — an XSS payload still can't load an external script,
  // only run inline, which is the same ceiling 'unsafe-inline' always
  // implies.
  async headers() {
    const isDev = process.env.NODE_ENV === "development";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
