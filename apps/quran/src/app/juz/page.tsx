import Link from "next/link";
import type { Metadata } from "next";
import { getJuzNumbers, getVersesForJuz } from "@/lib/content/quran";
import { canonicalUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Juz — IqraSpace Quran",
  description: "Browse the Quran by Juz (para).",
  alternates: { canonical: canonicalUrl("/juz") },
};

/**
 * Juz list (Readme.md §10). A Juz commonly spans more than one Surah, so
 * each entry shows where it starts/ends rather than just a bare number.
 */
export default function JuzListPage() {
  const juzNumbers = getJuzNumbers();

  return (
    <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ marginBottom: "0.25rem" }}>Juz</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>{juzNumbers.length} of 30 Juz available.</p>

      <ol aria-label="List of Juz" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {juzNumbers.map((juzNumber) => {
          const verses = getVersesForJuz(juzNumber);
          const first = verses[0];
          const last = verses[verses.length - 1];
          return (
            <li key={juzNumber}>
              <Link
                href={`/juz/${juzNumber}`}
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
                    {juzNumber}
                  </span>
                  <strong>Juz {juzNumber}</strong>
                </span>

                {first && last && (
                  <span style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", textAlign: "right" }}>
                    {first.surahName} {first.verse_key} – {last.surahName} {last.verse_key}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
