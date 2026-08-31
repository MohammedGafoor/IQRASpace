import type { MetadataRoute } from "next";
import { basePath } from "@/lib/site";

/**
 * PWA manifest — this app had none before. BasePath-aware the same way
 * apps/quran's manifest.ts is: a Next.js metadata route's own URL is
 * basePath-aware automatically, but the *values inside* it aren't, so
 * start_url/icon URLs need the same prefix by hand.
 */
export default function manifest(): MetadataRoute.Manifest {
  const base = basePath();

  return {
    name: "IqraSpace Learning",
    short_name: "IqraSpace",
    description: "Online Quran learning management for a solo tutor and their students.",
    start_url: `${base}/`,
    display: "standalone",
    background_color: "#faf8f3",
    theme_color: "#0b6b5c",
    lang: "en",
    icons: [
      { src: `${base}/apple-icon`, sizes: "180x180", type: "image/png" },
      { src: `${base}/icon`, sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
