"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { CSSProperties, Ref } from "react";

type NavTarget = { href: string; label: string };

type Props = {
  previous: NavTarget | undefined;
  next: NavTarget | undefined;
  variant?: "top" | "bottom";
  /** The Surah/Page currently open, shown centered between Previous
      and Next — bold, in the strongest available text color so it reads
      as the "you are here" anchor rather than another link (Previous/
      Next stay in the teal link color either side of it). Only rendered
      for the "top" variant — see the doc comment below for why "bottom"
      is a plain repeat, not a full nav bar. */
  current?: string;
};

/**
 * Prev/next navigation, shared by Surah/Page readers (each just
 * supplies its own href/label pairs) — kept as one component so the
 * two readers can't drift into subtly different markup/behavior.
 *
 * Every reader renders this twice (top and bottom of the ayah list) —
 * only the top one is a `<nav>` landmark. Two identically-labeled
 * landmarks on one page is confusing for landmark-based screen-reader
 * navigation (found by an axe-core scan, not by inspection — see
 * PRODUCT-ROADMAP.md's Phase 1 status); the bottom copy is a plain
 * repeat for convenience, not a second landmark to jump to.
 *
 * The "top" copy is sticky, stacked directly beneath SiteHeader (see
 * that component's own sticky/--site-header-height comment) so it — and
 * the current Surah/Page name — stay visible while scrolling.
 * CSS Grid (1fr / auto / 1fr), not flex `justify-content: space-between`:
 * with two differently-sized Previous/Next labels either side, `space-
 * between` would put equal *gaps* around the current-name span rather
 * than actually centering it — the grid's two equal 1fr tracks are what
 * make the middle column land at the true visual center regardless of
 * how long either label is.
 */
export function ReaderNavBar({ previous, next, variant = "top", current }: Props) {
  const Container = variant === "top" ? "nav" : "div";
  const isTop = variant === "top";
  // Container itself is one of two intrinsic tags (nav/div) chosen at
  // runtime, so TS can't narrow which HTMLElement subtype its own `ref`
  // prop expects — both are plain HTMLElements for every purpose this
  // ref is actually used for (measuring rendered height), hence the cast.
  const navRef = useRef<HTMLElement>(null);

  // Keeps --reader-navbar-height (globals.css) in sync with this row's
  // REAL rendered height — see that CSS var's own comment for why (PDF
  // Mode's own toolbar stacks sticky beneath it). Only the "top" variant
  // is sticky/measured; the "bottom" copy never needs this.
  useEffect(() => {
    if (!isTop) return;
    const el = navRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty("--reader-navbar-height", `${entry.contentRect.height}px`);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isTop]);

  return (
    <Container
      ref={navRef as Ref<HTMLDivElement>}
      {...(isTop ? { "aria-label": "Surah/Page navigation" } : {})}
      style={isTop ? topNavStyle : bottomNavStyle}
    >
      {previous ? (
        <Link href={previous.href} style={{ ...navLinkStyle, justifySelf: "start" }}>
          ← {previous.label}
        </Link>
      ) : (
        <span />
      )}
      {isTop && (
        <span style={currentLabelStyle}>{current}</span>
      )}
      {next ? (
        <Link href={next.href} style={{ ...navLinkStyle, justifySelf: "end" }}>
          {next.label} →
        </Link>
      ) : (
        <span style={{ justifySelf: "end" }} />
      )}
    </Container>
  );
}

const navLinkStyle: CSSProperties = {
  color: "var(--color-primary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const currentLabelStyle: CSSProperties = {
  fontWeight: 700,
  color: "var(--color-text)",
  textAlign: "center",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const topNavStyle: CSSProperties = {
  position: "sticky",
  top: "var(--site-header-height)",
  zIndex: 40,
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: "0.75rem",
  background: "var(--color-surface)",
  borderBottom: "1px solid var(--color-border)",
  padding: "0.65rem 0.25rem",
  marginBottom: "1.5rem",
};

const bottomNavStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: "2rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--color-border)",
};
