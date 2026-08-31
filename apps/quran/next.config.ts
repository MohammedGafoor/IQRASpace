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
  async headers() {
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
              "script-src 'self'",
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
