/**
 * Single source of truth for this app's public site origin and base
 * path — every place that builds an absolute/canonical URL (root
 * layout metadata, manifest, sitemap, per-page canonicals) reads from
 * here instead of hardcoding the domain or "/quran", so the two can
 * never drift apart if either ever changes.
 *
 * ARCHITECTURE.md §8: this app is served at https://iqraspace.org/quran
 * via a Multi-Zones rewrite from the root landing app (apps/landing).
 * NEXT_BASE_PATH=/quran is set in this app's own production Vercel
 * project, mirroring next.config.ts's `basePath`. Local dev and CI
 * builds leave it unset, so URLs built here fall back to the bare
 * origin — correct for those environments too, not just production.
 */

export const SITE_ORIGIN = "https://iqraspace.org";

/** The basePath this app is deployed under (mirrors next.config.ts). */
export function basePath(): string {
  return process.env.NEXT_BASE_PATH || "";
}

/** Builds an absolute, canonical URL for a path within this app, e.g. canonicalUrl("/surah/1"). */
export function canonicalUrl(path: string = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${basePath()}${normalized}`;
}
