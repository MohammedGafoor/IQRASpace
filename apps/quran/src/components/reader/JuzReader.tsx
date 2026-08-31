"use client";

import { useReaderPreferences } from "@/lib/preferences/ReaderPreferencesProvider";
import { ReaderToolbar } from "./ReaderToolbar";
import { ReaderNavBar } from "./ReaderNavBar";
import { AyahList } from "./AyahList";
import type { VerseWithSurah } from "@/lib/content/types";

type Props = {
  juzNumber: number;
  verses: VerseWithSurah[];
  previous: number | undefined;
  next: number | undefined;
};

/**
 * Juz reader (Readme.md §10) — a Juz commonly spans more than one Surah
 * (e.g. Juz 1 runs from the start of Al-Fatihah into early Al-Baqarah),
 * so this renders a continuous ayah list with a Surah-name heading
 * wherever the Surah actually changes (AyahList's showSurahHeadings),
 * rather than one big Surah-style header like SurahReader's.
 */
export function JuzReader({ juzNumber, verses, previous, next }: Props) {
  const { preferences } = useReaderPreferences();

  const navPrevious = previous ? { href: `/juz/${previous}`, label: `Juz ${previous}` } : undefined;
  const navNext = next ? { href: `/juz/${next}`, label: `Juz ${next}` } : undefined;

  return (
    <div style={{ maxWidth: "var(--reader-max-width)", margin: "0 auto", padding: "1.5rem 1rem" }}>
      <ReaderNavBar previous={navPrevious} next={navNext} variant="top" />

      <header style={{ textAlign: "center", marginBottom: "2rem" }}>
        <p style={{ color: "var(--color-text-muted)", margin: 0, fontSize: "0.85rem" }}>
          {verses.length} Ayahs
        </p>
        <h1 style={{ margin: "0.25rem 0", color: "var(--color-primary)" }}>Juz {juzNumber}</h1>
      </header>

      <ReaderToolbar />

      <AyahList
        verses={verses}
        translationVisible={preferences.translationVisible}
        showSurahHeadings
        ariaLabel={`Ayahs of Juz ${juzNumber}`}
      />

      <ReaderNavBar previous={navPrevious} next={navNext} variant="bottom" />
    </div>
  );
}
