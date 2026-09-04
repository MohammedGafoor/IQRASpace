"use client";

import { useReaderPreferences } from "@/lib/preferences/ReaderPreferencesProvider";
import { ReaderNavBar } from "./ReaderNavBar";
import { AyahList } from "./AyahList";
import type { VerseWithSurah } from "@/lib/content/types";

type Props = {
  pageNumber: number;
  verses: VerseWithSurah[];
  previous: number | undefined;
  next: number | undefined;
};

/**
 * Mushaf page reader (Readme.md §10) — a printed page can span two
 * Surahs, so this reuses the same shared pieces (AyahList, ReaderNavBar)
 * as SurahReader so the two readers can't drift apart in behavior.
 */
export function PageReader({ pageNumber, verses, previous, next }: Props) {
  const { preferences } = useReaderPreferences();

  const navPrevious = previous ? { href: `/page/${previous}`, label: `Page ${previous}` } : undefined;
  const navNext = next ? { href: `/page/${next}`, label: `Page ${next}` } : undefined;

  return (
    <div style={{ maxWidth: "var(--reader-max-width)", margin: "0 auto", padding: "1.5rem 1rem" }}>
      <ReaderNavBar previous={navPrevious} next={navNext} variant="top" current={`Page ${pageNumber}`} />

      <header style={{ textAlign: "center", marginBottom: "2rem" }}>
        <p style={{ color: "var(--color-text-muted)", margin: 0, fontSize: "0.85rem" }}>
          {verses.length} Ayahs
        </p>
        <h1 style={{ margin: "0.25rem 0", color: "var(--color-primary)" }}>Page {pageNumber}</h1>
      </header>

      <AyahList
        verses={verses}
        enabledTranslations={preferences.enabledTranslations}
        showBookmarks={preferences.showBookmarks}
        showSurahHeadings
        ariaLabel={`Ayahs on page ${pageNumber}`}
      />

      <ReaderNavBar previous={navPrevious} next={navNext} variant="bottom" />
    </div>
  );
}
