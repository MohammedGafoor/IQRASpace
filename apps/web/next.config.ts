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
};

export default nextConfig;
