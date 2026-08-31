import type { MetadataRoute } from "next";
import { basePath } from "@/lib/site";

/**
 * Replaces the old static public/manifest.webmanifest. As a static file
 * it hardcoded "/icon", "/apple-icon", and start_url "/" — none of which
 * account for NEXT_BASE_PATH="/quran" in production, so the installed
 * PWA's icons would 404 and it would start outside this app entirely
 * (see PROJECT-STATUS.md's production-readiness notes). A Next.js
 * metadata route is basePath-aware for its own URL (served at
 * /quran/manifest.webmanifest, with the matching <link rel="manifest">
 * auto-emitted by the root layout) but the *values inside* it still need
 * building by hand — hence basePath() here.
 */
export default function manifest(): MetadataRoute.Manifest {
  const base = basePath();

  return {
    name: "IqraSpace Quran",
    short_name: "IqraSpace",
    description: "Read. Listen. Learn. Reflect. A free, fast, and accessible way to read the Quran.",
    start_url: `${base}/`,
    display: "standalone",
    background_color: "#faf7f0",
    theme_color: "#0f5c4f",
    lang: "en",
    icons: [
      { src: `${base}/apple-icon`, sizes: "180x180", type: "image/png" },
      { src: `${base}/icon`, sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
