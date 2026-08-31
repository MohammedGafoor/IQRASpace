import Link from "next/link";
import type { Metadata } from "next";
import { getAllChapters } from "@/lib/content/quran";
import { canonicalUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Surahs — IqraSpace Quran",
  description: "Browse every Surah of the Quran.",
  alternates: { canonical: canonicalUrl("/surah") },
};

/**
 * Surah list (Readme.md §10). Server Component: reads the synced content
 * directly, no client fetch. Renders however many Surahs are actually
 * synced (see lib/content/quran.ts's header note) — currently 2 of 114,
 * a real constraint of the registered pre-live project, not a bug in
 * this page (QURAN-CONTENT.md §4a).
 */
export default function SurahListPage() {
  const chapters = getAllChapters();

  return (
    <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ marginBottom: "0.25rem" }}>Surahs</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
        {chapters.length} of 114 Surahs available right now.
      </p>

      <ol aria-label="List of Surahs" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {chapters.map((chapter) => (
          <li key={chapter.id}>
            <Link
              href={`/surah/${chapter.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                padding: "1rem",
                borderBottom: "1px solid var(--color-border)",
                textDecoration: "none",
                color: "var(--color-text)",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "2rem",
                    height: "2rem",
                    borderRadius: "9999px",
                    border: "1px solid var(--color-border)",
                    fontSize: "0.8rem",
                    color: "var(--color-text-muted)",
                    flexShrink: 0,
                  }}
                >
                  {chapter.id}
                </span>
                <span>
                  <strong>{chapter.name_simple}</strong>
                  <span style={{ color: "var(--color-text-muted)" }}> · {chapter.translated_name.name}</span>
                </span>
              </span>

              <span dir="rtl" lang="ar" style={{ fontFamily: "var(--font-arabic)", fontSize: "1.25rem" }}>
                {chapter.name_arabic}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
