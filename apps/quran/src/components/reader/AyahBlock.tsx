"use client";

import { useEffect, useState } from "react";
import { loadBookmarks, toggleBookmark } from "@/lib/preferences/storage";
import { ayahElementId } from "@/lib/reader/ayahDom";
import type { Verse } from "@/lib/content/types";

type Props = {
  verse: Verse;
  translationVisible: boolean;
  registerRef: (el: HTMLElement | null) => void;
  /** Rendered as a heading directly above this ayah — used by Juz/Page
      views to mark where a new Surah begins mid-list (a Surah reader
      already shows its name in the page header, so passes nothing). */
  surahHeading?: string;
};

/**
 * One ayah: Arabic text, verse-number badge, optional translation,
 * bookmark toggle. Bookmarking works with no account (Readme.md §15) —
 * see lib/preferences/storage.ts.
 */
export function AyahBlock({ verse, translationVisible, registerRef, surahHeading }: Props) {
  const bookmarkKey = verse.verse_key;
  const [bookmarked, setBookmarked] = useState(false);

  // Hydration-safe, same pattern as ReaderPreferencesProvider: default to
  // "not bookmarked" during SSR, correct it after mount.
  useEffect(() => {
    async function hydrate() {
      const isBookmarked = loadBookmarks().includes(bookmarkKey);
      await Promise.resolve(); // satisfies react-hooks/set-state-in-effect
      setBookmarked(isBookmarked);
    }
    hydrate();
  }, [bookmarkKey]);

  return (
    <li
      ref={registerRef}
      id={ayahElementId(verse.verse_key)}
      data-verse-key={verse.verse_key}
      tabIndex={-1}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        padding: "1.25rem 0",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      {surahHeading && (
        <h2
          style={{
            margin: "0 0 0.5rem",
            fontSize: "0.95rem",
            fontWeight: 600,
            color: "var(--color-primary)",
          }}
        >
          {surahHeading}
        </h2>
      )}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "1.75rem",
            height: "1.75rem",
            borderRadius: "9999px",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
            fontSize: "0.75rem",
            marginTop: "0.25rem",
          }}
        >
          {verse.verse_number}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            dir="rtl"
            lang="ar"
            style={{
              fontFamily: "var(--font-arabic)",
              fontSize: "calc(1.6rem * var(--reader-arabic-scale))",
              lineHeight: "calc(2 * var(--reader-line-spacing))",
              margin: 0,
              color: "var(--color-text)",
            }}
          >
            {verse.text_uthmani}
          </p>

          {translationVisible && verse.translations[0] && (
            <p
              style={{
                fontSize: "calc(1rem * var(--reader-translation-scale))",
                lineHeight: "calc(1.6 * var(--reader-line-spacing))",
                color: "var(--color-text-muted)",
                marginTop: "0.5rem",
                marginBottom: 0,
              }}
            >
              {verse.translations[0].text}
            </p>
          )}

          <button
            type="button"
            onClick={() => setBookmarked(toggleBookmark(bookmarkKey).includes(bookmarkKey))}
            aria-pressed={bookmarked}
            aria-label={
              bookmarked ? `Remove bookmark for ayah ${verse.verse_key}` : `Bookmark ayah ${verse.verse_key}`
            }
            style={{
              marginTop: "0.5rem",
              background: "none",
              border: "none",
              padding: 0,
              fontSize: "0.8rem",
              color: bookmarked ? "var(--color-accent-text)" : "var(--color-text-muted)",
              cursor: "pointer",
            }}
          >
            {bookmarked ? "★ Bookmarked" : "☆ Bookmark"}
          </button>
        </div>
      </div>
    </li>
  );
}
