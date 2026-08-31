import type { MetadataRoute } from "next";
import { getAllChapters, getJuzNumbers, getPageNumbers } from "@/lib/content/quran";
import { canonicalUrl } from "@/lib/site";

/**
 * Enumerates every URL actually reachable in this app — reuses the same
 * getAllChapters/getJuzNumbers/getPageNumbers functions the dynamic
 * routes' own generateStaticParams already call, so this can never list
 * a page that doesn't really exist (or omit one that does). Served at
 * /quran/sitemap.xml (basePath-aware, like manifest.ts) and referenced
 * from apps/landing/robots.txt's `Sitemap:` line, since robots.txt
 * itself has to live at the true domain root, which this app doesn't own
 * (ARCHITECTURE.md §8).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: canonicalUrl("/"), changeFrequency: "monthly", priority: 1 },
    { url: canonicalUrl("/surah"), changeFrequency: "monthly", priority: 0.8 },
    { url: canonicalUrl("/juz"), changeFrequency: "monthly", priority: 0.6 },
    { url: canonicalUrl("/page"), changeFrequency: "monthly", priority: 0.6 },
  ];

  const surahPages: MetadataRoute.Sitemap = getAllChapters().map((chapter) => ({
    url: canonicalUrl(`/surah/${chapter.id}`),
    changeFrequency: "yearly",
    priority: 0.7,
  }));

  const juzPages: MetadataRoute.Sitemap = getJuzNumbers().map((juzNumber) => ({
    url: canonicalUrl(`/juz/${juzNumber}`),
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  const mushafPages: MetadataRoute.Sitemap = getPageNumbers().map((pageNumber) => ({
    url: canonicalUrl(`/page/${pageNumber}`),
    changeFrequency: "yearly",
    priority: 0.4,
  }));

  return [...staticPages, ...surahPages, ...juzPages, ...mushafPages];
}
