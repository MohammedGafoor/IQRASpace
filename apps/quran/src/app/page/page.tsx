import Link from "next/link";
import type { Metadata } from "next";
import { getPageNumbers, getVersesForPage } from "@/lib/content/quran";
import { canonicalUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mushaf Pages — IqraSpace Quran",
  description: "Browse the Quran by Mushaf page.",
  alternates: { canonical: canonicalUrl("/page") },
};

/**
 * Mushaf page list (Readme.md §10). Route is literally "/page" (a list)
 * and "/page/[pageNumber]" (a reader) — matches the common convention
 * other Quran sites use for this same concept.
 */
export default function PageListPage() {
  const pageNumbers = getPageNumbers();

  return (
    <div style={{ maxWidth: "40rem", margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ marginBottom: "0.25rem" }}>Mushaf Pages</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>{pageNumbers.length} pages available.</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(3.5rem, 1fr))",
          gap: "0.5rem",
        }}
      >
        {pageNumbers.map((pageNumber) => {
          const verses = getVersesForPage(pageNumber);
          const firstVerse = verses[0];
          return (
            <Link
              key={pageNumber}
              href={`/page/${pageNumber}`}
              aria-label={firstVerse ? `Page ${pageNumber}, starting ${firstVerse.surahName} ${firstVerse.verse_key}` : `Page ${pageNumber}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                aspectRatio: "1",
                border: "1px solid var(--color-border)",
                borderRadius: "0.375rem",
                textDecoration: "none",
                color: "var(--color-text)",
                fontSize: "0.85rem",
              }}
            >
              {pageNumber}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
