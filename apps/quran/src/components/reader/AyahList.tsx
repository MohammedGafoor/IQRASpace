"use client";

import { useEffect, useRef } from "react";
import { saveLastPosition } from "@/lib/preferences/storage";
import { AyahBlock } from "./AyahBlock";
import type { TranslationLanguageId } from "@/lib/content/translations";
import type { VerseWithSurah } from "@/lib/content/types";

type Props = {
  verses: VerseWithSurah[];
  enabledTranslations: TranslationLanguageId[];
  /** Show a Surah-name heading whenever the Surah changes mid-list — for
      Juz/Page views, which cross Surah boundaries. A single-Surah reader
      already names the Surah in its own page header, so passes false. */
  showSurahHeadings: boolean;
  ariaLabel: string;
};

/**
 * Shared ayah-list rendering + Continue Reading tracking, used by the
 * Surah, Juz, and Page readers alike (Readme.md §10/§16) — one place for
 * the IntersectionObserver/scroll-restore logic instead of three
 * near-identical copies.
 */
export function AyahList({ verses, enabledTranslations, showSurahHeadings, ariaLabel }: Props) {
  const ayahRefs = useRef(new Map<string, HTMLElement>());
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Continue Reading (Readme.md §16): track whichever ayah is topmost in
  // the viewport while scrolling, debounced, so "return to exactly where
  // they stopped" reflects the ayah actually being read, not just which
  // Surah/Juz/Page was opened.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
        const verseKey = topMost.target.getAttribute("data-verse-key");
        if (!verseKey) return;
        const [surahNumber, ayahNumber] = verseKey.split(":").map(Number);
        if (!surahNumber || !ayahNumber) return;

        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(() => {
          saveLastPosition({ surahNumber, ayahNumber });
        }, 800);
      },
      { rootMargin: "-10% 0px -70% 0px", threshold: 0 }
    );

    for (const el of ayahRefs.current.values()) observer.observe(el);
    return () => {
      observer.disconnect();
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
    // Re-observe whenever the verse set changes (new Surah/Juz/Page).
  }, [verses]);

  // Deep-link support (Continue Reading, and any future shared-ayah
  // link): ?verse=2:255 scrolls straight to that ayah. Plain browser API,
  // not next/navigation's useSearchParams — see SurahReader's original
  // note on why (avoids forcing a Suspense boundary on a statically
  // generated page for one optional behavior).
  useEffect(() => {
    const verseParam = new URLSearchParams(window.location.search).get("verse");
    if (!verseParam) return;
    const target = ayahRefs.current.get(verseParam);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [verses]);

  return (
    <ol aria-label={ariaLabel} style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {verses.map((verse, index) => {
        const previous = verses[index - 1];
        const isNewSurah = showSurahHeadings && (!previous || previous.surahId !== verse.surahId);
        return (
          <AyahBlock
            key={verse.verse_key}
            verse={verse}
            enabledTranslations={enabledTranslations}
            surahHeading={isNewSurah ? verse.surahName : undefined}
            registerRef={(el) => {
              if (el) ayahRefs.current.set(verse.verse_key, el);
              else ayahRefs.current.delete(verse.verse_key);
            }}
          />
        );
      })}
    </ol>
  );
}
