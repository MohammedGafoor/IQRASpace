"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useReaderPreferences } from "@/lib/preferences/ReaderPreferencesProvider";
import { ReaderNavBar } from "./ReaderNavBar";
import { AyahList } from "./AyahList";
import { JumpToAyah } from "./JumpToAyah";
import type { Chapter, Verse } from "@/lib/content/types";
import type { SurahPdfInfo } from "@/lib/content/pdf";

// pdfjs-dist's browser build touches browser-only globals (DOMMatrix,
// Path2D, …) at module scope, which crashes if evaluated during Next's
// server-side prerender of this "use client" component's initial HTML —
// `ssr: false` defers loading PdfViewer's whole module graph to the
// browser only. See PDF-CONTENT.md.
const PdfViewer = dynamic(() => import("./PdfViewer").then((m) => m.PdfViewer), { ssr: false });

type Props = {
  chapter: Chapter;
  verses: Verse[];
  previous: Chapter | undefined;
  next: Chapter | undefined;
  /** undefined if this Surah's PDF hasn't been generated yet — PDF Mode
      then silently falls back to the normal text view below, never a
      broken page (see lib/content/pdf.ts). */
  pdfInfo: SurahPdfInfo | undefined;
};

/**
 * The reader itself (Readme.md §11) — the most important component in the
 * app. Peaceful, minimal: chapter heading, optional Bismillah, ayah list,
 * prev/next Surah navigation. Ayah-list rendering and Continue Reading
 * tracking live in the shared AyahList (also used by the Page reader).
 */
export function SurahReader({ chapter, verses, previous, next, pdfInfo }: Props) {
  const { preferences } = useReaderPreferences();
  const showPdf = preferences.pdfMode && pdfInfo !== undefined;

  const versesWithSurah = useMemo(
    () => verses.map((v) => ({ ...v, surahId: chapter.id, surahName: chapter.name_simple })),
    [verses, chapter.id, chapter.name_simple]
  );

  const navPrevious = previous ? { href: `/surah/${previous.id}`, label: previous.name_simple } : undefined;
  const navNext = next ? { href: `/surah/${next.id}`, label: next.name_simple } : undefined;

  // PDF Mode gets its own, wider container (--pdf-reader-max-width) — a
  // scanned page image benefits from the available viewport width in a
  // way prose text at --reader-max-width deliberately doesn't (see
  // globals.css's comment). Header/nav stay put; only how much of the
  // viewport the reader column claims changes.
  return (
    <div
      style={{
        maxWidth: showPdf ? "var(--pdf-reader-max-width)" : "var(--reader-max-width)",
        margin: "0 auto",
        padding: "1.5rem 1rem",
        // border-box only matters here in PDF mode: --pdf-reader-max-width
        // is vw-based (globals.css), so content-box's default of adding
        // padding ON TOP of that max-width could push the outer box a few
        // px past the true viewport width on narrower/tablet screens —
        // exactly the unwanted horizontal-scrollbar bug being fixed here,
        // just at a different width than the one it was first noticed at.
        ...(showPdf ? { boxSizing: "border-box" as const } : {}),
      }}
    >
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

      {!showPdf && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
          <JumpToAyah surahId={chapter.id} versesCount={chapter.verses_count} />
        </div>
      )}

      {showPdf ? (
        <PdfViewer file={pdfInfo.file} />
      ) : (
        <AyahList
          verses={versesWithSurah}
          enabledTranslations={preferences.enabledTranslations}
          showBookmarks={preferences.showBookmarks}
          showSurahHeadings={false}
          ariaLabel={`Ayahs of ${chapter.name_simple}`}
        />
      )}

      <ReaderNavBar previous={navPrevious} next={navNext} variant="bottom" />
    </div>
  );
}
