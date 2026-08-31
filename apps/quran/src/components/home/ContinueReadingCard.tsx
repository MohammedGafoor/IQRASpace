"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { loadLastPosition, type ReadingPosition } from "@/lib/preferences/storage";
import type { Chapter } from "@/lib/content/types";

type Props = {
  chapters: Chapter[];
};

/**
 * Home page's "Continue Reading" (Readme.md §16). Client component — the
 * last position lives in localStorage, so this can't be a Server
 * Component. `chapters` is passed down from the server page instead of
 * fetched again here, since content loading is server-only (lib/content).
 */
export function ContinueReadingCard({ chapters }: Props) {
  const [position, setPosition] = useState<ReadingPosition | null>(null);

  useEffect(() => {
    async function hydrate() {
      const loaded = loadLastPosition();
      await Promise.resolve(); // satisfies react-hooks/set-state-in-effect
      setPosition(loaded);
    }
    hydrate();
  }, []);

  // Server-rendered HTML (and the client's very first render, before the
  // effect above runs) always has no known last position — rendering
  // "Start Reading" for that case, same as a genuinely first-time visitor,
  // means the home page's primary CTA is a real link in the initial HTML
  // (works with JS disabled/slow, crawlable, no flash-of-missing-button)
  // rather than something that only appears after hydration completes.
  // It's corrected to "Continue Reading" a moment later for returning
  // visitors once localStorage has actually been read.
  if (!position) {
    const first = chapters[0];
    return (
      <Link href={first ? `/surah/${first.id}` : "/surah"} style={ctaStyle}>
        Start Reading →
      </Link>
    );
  }

  const chapter = chapters.find((c) => c.id === position.surahNumber);
  return (
    <Link
      href={`/surah/${position.surahNumber}?verse=${position.surahNumber}:${position.ayahNumber}`}
      style={ctaStyle}
    >
      Continue Reading{chapter ? ` — ${chapter.name_simple}, Ayah ${position.ayahNumber}` : ""} →
    </Link>
  );
}

const ctaStyle: CSSProperties = {
  display: "inline-block",
  padding: "0.75rem 1.5rem",
  borderRadius: "0.5rem",
  background: "var(--color-primary)",
  color: "var(--color-primary-contrast)",
  textDecoration: "none",
  fontWeight: 600,
};
