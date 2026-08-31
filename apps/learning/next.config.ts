import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // This app lives in a monorepo-ish layout (root package.json only holds the
  // Supabase CLI devDependency — see /package.json and docs/architecture.md §19).
  // Pin Turbopack's root here so it doesn't get confused by the extra
  // package-lock.json one level up.
  turbopack: {
    root: path.join(__dirname),
  },

  // Multi-Zones cutover (see root DEPLOYMENT.md / apps/quran/ARCHITECTURE.md
  // §8 for the pattern this mirrors): this app moves from the bare "/" it's
  // served at today to "/learning", reachable at https://iqraspace.org/learning
  // via a rewrite in apps/landing/vercel.json. NEXT_BASE_PATH is unset in
  // local dev and this app's own CI build, so both fall back to the bare
  // origin unchanged — only the Vercel Production/Preview env vars for this
  // project set it.
  basePath: process.env.NEXT_BASE_PATH || undefined,

  // Compatibility redirects for already-bookmarked bare URLs (this app was
  // live at https://iqraspace.vercel.app/login, /dashboard, etc. before the
  // basePath cutover — real tutor/student/admin accounts may have those
  // saved). Deliberately gated on NEXT_BASE_PATH actually being set, not
  // just present in this file: if the env var isn't live yet, this returns
  // an empty array and old behavior is fully preserved — there's no window
  // where a redirect fires pointing at a basePath that isn't actually
  // active yet (confirmed against this Next version's own installed docs,
  // node_modules/next/dist/docs/.../redirects.md: "source"/"destination"
  // are auto-prefixed with basePath unless a rule sets `basePath: false`,
  // which is what lets these rules target the *old*, unprefixed paths).
  //
  // Deliberately an explicit route list, not a catch-all "/:path*" — avoids
  // needing to reason about interaction with /_next static assets, /api
  // routes (none exist yet, but future-proofing), or public/ files, none of
  // which should ever be redirected.
  async redirects() {
    const base = process.env.NEXT_BASE_PATH;
    if (!base) return [];
    const routes = [
      "login",
      "signup",
      "dashboard",
      "admin",
      "attendance",
      "classes",
      "lessons",
      "materials",
      "meet",
      "notes",
      "notifications",
      "progress",
      "schedule",
      "settings",
      "students",
      "teach",
      "share",
    ];
    return [
      { source: "/", destination: base, basePath: false as const, permanent: false },
      ...routes.map((route) => ({
        source: `/${route}`,
        destination: `${base}/${route}`,
        basePath: false as const,
        permanent: false,
      })),
      ...routes.map((route) => ({
        source: `/${route}/:path*`,
        destination: `${base}/${route}/:path*`,
        basePath: false as const,
        permanent: false,
      })),
    ];
  },
};

export default nextConfig;
