"use client";

import { useMemo } from "react";
import { useReaderPreferences } from "@/lib/preferences/ReaderPreferencesProvider";
import { ReaderNavBar } from "./ReaderNavBar";
import { AyahList } from "./AyahList";
import { JumpToAyah } from "./JumpToAyah";
import type { Chapter, Verse } from "@/lib/content/types";

type Props = {
  chapter: Chapter;
  verses: Verse[];
  previous: Chapter | undefined;
  next: Chapter | undefined;
};

/**
 * The reader itself (Readme.md §11) — the most important component in the
 * app. Peaceful, minimal: chapter heading, optional Bismillah, ayah list,
 * prev/next Surah navigation. Ayah-list rendering and Continue Reading
 * tracking live in the shared AyahList (also used by Juz/Page readers).
 */
export function SurahReader({ chapter, verses, previous, next }: Props) {
  const { preferences } = useReaderPreferences();

  const versesWithSurah = useMemo(
    () => verses.map((v) => ({ ...v, surahId: chapter.id, surahName: chapter.name_simple })),
    [verses, chapter.id, chapter.name_simple]
  );

  const navPrevious = previous ? { href: `/surah/${previous.id}`, label: previous.name_simple } : undefined;
  const navNext = next ? { href: `/surah/${next.id}`, label: next.name_simple } : undefined;

  return (
    <div style={{ maxWidth: "var(--reader-max-width)", margin: "0 auto", padding: "1.5rem 1rem" }}>
      <ReaderNavBar previous={navPrevious} next={navNext} variant="top" current={chapter.name_simple} />

      <header style={{ textAlign: "center", marginBottom: "2rem" }}>
        <p style={{ color: "var(--color-text-muted)", margin: 0, fontSize: "0.85rem" }}>
          Surah {chapter.id} · {chapter.verses_count} Ayahs ·{" "}
          {chapter.revelation_place === "makkah" ? "Makkah" : "Madinah"}
        </p>
        <h1
          dir="rtl"
          lang="ar"
          style={{
            fontFamily: "var(--font-arabic)",
            fontSize: "2.25rem",
            margin: "0.5rem 0",
            color: "var(--color-primary)",
          }}
        >
          {chapter.name_arabic}
        </h1>
        <p style={{ margin: 0, fontWeight: 600 }}>{chapter.name_simple}</p>
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>{chapter.translated_name.name}</p>
      </header>

      {chapter.bismillah_pre && (
        <p
          dir="rtl"
          lang="ar"
          style={{
            textAlign: "center",
            fontFamily: "var(--font-arabic)",
            fontSize: "calc(1.5rem * var(--reader-arabic-scale))",
            color: "var(--color-primary)",
            marginBottom: "2rem",
          }}
        >
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
        <JumpToAyah surahId={chapter.id} versesCount={chapter.verses_count} />
      </div>

      <AyahList
        verses={versesWithSurah}
        enabledTranslations={preferences.enabledTranslations}
        showBookmarks={preferences.showBookmarks}
        showSurahHeadings={false}
        ariaLabel={`Ayahs of ${chapter.name_simple}`}
      />

      <ReaderNavBar previous={navPrevious} next={navNext} variant="bottom" />
    </div>
  );
}
