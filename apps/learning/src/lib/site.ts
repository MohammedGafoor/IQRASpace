/**
 * Single source of truth for this app's public site origin and base
 * path — every place that builds an absolute/canonical URL (root layout
 * metadataBase, manifest) reads from here instead of hardcoding the
 * domain or "/learning", so the two can never drift apart if either ever
 * changes. Same shape as apps/quran/src/lib/site.ts, which solved the
 * same problem first.
 *
 * This app is served at https://iqraspace.org/learning via a Multi-Zones
 * rewrite from the root landing app (apps/landing) — see
 * next.config.ts's basePath comment. NEXT_BASE_PATH=/learning is set in
 * this app's own production Vercel project ("iqraspace"); local dev and
 * CI builds leave it unset, so URLs built here fall back to the bare
 * origin — correct for those environments too, not just production.
 */

export const SITE_ORIGIN = "https://iqraspace.org";

/** The basePath this app is deployed under (mirrors next.config.ts). */
export function basePath(): string {
  return process.env.NEXT_BASE_PATH || "";
}

/** Builds an absolute, canonical URL for a path within this app, e.g. canonicalUrl("/dashboard"). */
export function canonicalUrl(path: string = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${basePath()}${normalized}`;
}
