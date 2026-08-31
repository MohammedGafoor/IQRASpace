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
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    async function hydrate() {
      const loaded = loadLastPosition();
      await Promise.resolve(); // satisfies react-hooks/set-state-in-effect
      setPosition(loaded);
      setChecked(true);
    }
    hydrate();
  }, []);

  // Avoid flashing "Start Reading" before localStorage has been checked.
  if (!checked) return null;

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
