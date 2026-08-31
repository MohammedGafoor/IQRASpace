"use client";

import Link from "next/link";
import { useReaderPreferences } from "@/lib/preferences/ReaderPreferencesProvider";
import { BrandWordmark } from "./BrandWordmark";
import type { Theme } from "@/lib/preferences/types";

const THEME_CYCLE: Record<Theme, Theme> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const THEME_LABEL: Record<Theme, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

/**
 * Persistent, minimal header (Readme.md §11 — "do not overcrowd").
 * Reading/navigation never requires an account, so there is deliberately
 * no sign-in control here yet — that's Phase 5.
 */
export function SiteHeader() {
  const { preferences, setPreference } = useReaderPreferences();

  return (
    <header
      style={{
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      <div
        style={{
          maxWidth: "64rem",
          margin: "0 auto",
          padding: "0.75rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }} aria-label="IqraSpace Quran — home">
          <BrandWordmark />
        </Link>

        <nav aria-label="Primary" style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <Link href="/surah" style={{ color: "var(--color-text)", textDecoration: "none" }}>
            Surahs
          </Link>
          <Link href="/juz" style={{ color: "var(--color-text)", textDecoration: "none" }}>
            Juz
          </Link>
          <Link href="/page" style={{ color: "var(--color-text)", textDecoration: "none" }}>
            Pages
          </Link>
          <button
            type="button"
            onClick={() => setPreference("theme", THEME_CYCLE[preferences.theme])}
            aria-label={`Theme: ${THEME_LABEL[preferences.theme]}. Activate to change.`}
            style={{
              background: "transparent",
              border: "1px solid var(--color-border)",
              borderRadius: "0.375rem",
              padding: "0.35rem 0.65rem",
              color: "var(--color-text)",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            {THEME_LABEL[preferences.theme]}
          </button>
        </nav>
      </div>
    </header>
  );
}
