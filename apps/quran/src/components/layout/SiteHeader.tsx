"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useReaderPreferences } from "@/lib/preferences/ReaderPreferencesProvider";
import { ReaderSettingsPanel } from "@/components/reader/ReaderSettingsPanel";
import { BrandWordmark } from "./BrandWordmark";
import type { Theme } from "@/lib/preferences/types";

// Matches /surah/1, /juz/5, /page/23 — an open Surah/Juz/Page — but not
// the bare list pages (/surah, /juz, /page), which show no Ayah text and
// so have nothing for Settings' font/translation/bookmark controls to
// visibly affect.
const READER_PAGE_PATTERN = /^\/(surah|juz|page)\/[^/]+/;

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
 *
 * Sticky (not `position: fixed`) so it stays visible while scrolling: a
 * sticky element still reserves its own space in normal document flow,
 * so nothing below it needs manual top-padding to avoid being covered —
 * `fixed` would need that compensation recalculated every time this
 * header's height changes (e.g. its nav wrapping onto a second line on a
 * narrow viewport), which sticky avoids entirely. The Surah/Juz/Page nav
 * row (ReaderNavBar's "top" variant) stacks sticky directly beneath this
 * one, offset by --site-header-height (measured below).
 */
export function SiteHeader() {
  const { preferences, setPreference } = useReaderPreferences();
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const isReaderPage = READER_PAGE_PATTERN.test(pathname ?? "");

  // Keeps --site-header-height (globals.css) in sync with this header's
  // REAL rendered height, not a guessed constant — it can change (its nav
  // row wrapping at narrow widths, a browser font-size setting, etc.), and
  // ReaderNavBar's sticky "top" offset would drift out of sync with
  // whatever guess was hardcoded otherwise.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty("--site-header-height", `${entry.contentRect.height}px`);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <header
      ref={headerRef}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
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
          {/* Only on an open Surah/Juz/Page — see READER_PAGE_PATTERN.
              Was previously duplicated inline on each reader page; now
              one place, reachable without scrolling back up past the
              Ayah list. */}
          {isReaderPage && <ReaderSettingsPanel />}
        </nav>
      </div>
    </header>
  );
}
