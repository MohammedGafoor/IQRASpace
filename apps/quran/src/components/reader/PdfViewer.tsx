"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type TouchEvent } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// This app's CSP (next.config.ts) has no worker-src directive, so it
// falls back to script-src 'self' — a CDN-hosted pdfjs worker (the setup
// shown in most react-pdf docs) would be blocked. The worker is
// self-hosted instead: scripts/pdf/copy-pdf-worker.mjs (run via
// "postinstall") copies whatever pdf.worker.min.mjs this install's own
// pdfjs-dist (react-pdf's transitive dependency, not a separately
// installed copy — see PDF-CONTENT.md on why that pairing must match
// exactly) resolves to, into public/pdf-worker/. Same basePath-prefixing
// rule as BrandWordmark.tsx's <img src> — NEXT_PUBLIC_BASE_PATH is the
// client-safe, build-time-inlined env var (see next.config.ts's comment).
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
pdfjs.GlobalWorkerOptions.workerSrc = `${BASE_PATH}/pdf-worker/pdf.worker.min.mjs`;

type Props = {
  /** Relative to public/pdf/, e.g. "surah/2.pdf" — matches
      pdf-manifest.json's `file` shape (SurahPdfInfo). */
  file: string;
  /** 1-based page to open on first render. Defaults to 1. */
  initialPage?: number;
  /** Called whenever the visible page changes — a hook for a future
      "Continue Reading in PDF Mode" position-save (see PDF-CONTENT.md);
      nothing reads this yet. */
  onPageChange?: (page: number) => void;
};

const ZOOM_MIN = 0.75;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.25;

// Swipe-to-turn-page thresholds. MIN_DISTANCE_PX rules out a tap or a tiny
// jitter; MAX_DURATION_MS rules out a slow drag (e.g. text selection,
// unhurried panning) reading as a deliberate swipe; the horizontal/vertical
// ratio rules out an ordinary vertical scroll of the page (this reader's
// primary scroll direction) being misread as a page-turn swipe.
const SWIPE_MIN_DISTANCE_PX = 50;
const SWIPE_MAX_DURATION_MS = 800;
const SWIPE_MIN_HORIZONTAL_RATIO = 1.5;
// A zoomed-in page can itself scroll horizontally (PdfViewer's own
// fit-width/zoom comment above) — a swipe there should pan that first and
// only turn the page once already scrolled to the edge in the swiped
// direction, same convention as an image gallery/carousel. Comparing
// against the container's OWN scroll position measured at touchstart
// (before this gesture's native scrolling can move it) rather than at
// touchend avoids a fast swipe's own scroll motion reaching the edge and
// being misread as "was already there". A couple of px of slack for
// sub-pixel scroll-position rounding, not a meaningful pan distance.
const SWIPE_EDGE_SLACK_PX = 2;

// Continuous scroll (Readme.md's "read the whole Surah without clicking
// Next" requirement) means every page WOULD mount its own <canvas>
// up front if nothing held it back — fine for a short Surah, but Al-
// Baqarah alone is 65 pages, and rendering 65 full-resolution canvases
// on first paint would be real jank on a phone for no benefit (only a
// couple are ever actually visible at once). Instead only pages within
// RENDER_WINDOW_MARGIN of the viewport ever mount a real <Page> — every
// other page reserves its exact real height (from pageSizes, fetched
// once up front — see the Document onLoadSuccess handler) as a plain
// placeholder, so the page never jumps around as canvases mount in.
// Once a page has rendered it's never un-rendered: swapping a mounted
// canvas back out would itself cause a visible flicker/reflow for a
// memory saving this reader doesn't need (these are modest, single-
// Surah-sized documents, not hundred-page books).
const RENDER_WINDOW_MARGIN = "150% 0px 150% 0px";
// Which page counts as "current" (toolbar label, Prev/Next target) —
// the exact same rootMargin/topmost-wins idiom AyahList.tsx uses for
// Continue Reading, one level up (pages, not ayahs): the page whose top
// edge is highest while still on screen, biased toward the upper part
// of the viewport so the reader's eye and the label agree.
const CURRENT_PAGE_ROOT_MARGIN = "-10% 0px -70% 0px";

/**
 * Renders the original scanned Mushaf pages for "PDF Mode" — the exact
 * source PDF, unmodified, via pdfjs-dist (through react-pdf) to <canvas>.
 * Every page of the Surah is laid out in one continuous vertical column
 * (Readme.md: read straight through without clicking Next) rather than
 * one page at a time; Prev/Next/swipe/"Go to page" all just scroll to a
 * page already in that column. Text/annotation layers are explicitly
 * disabled: these are scans with no real text layer to render (see
 * PDF-CONTENT.md), so rendering them would be pure wasted work.
 *
 * Styled with this reader's existing inline-token convention (matching
 * JumpToAyah.tsx) rather than new CSS classes, so it reads as part of the
 * existing reader, not a foreign embed.
 */
export function PdfViewer({ file, initialPage = 1, onPageChange }: Props) {
  const [numPages, setNumPages] = useState<number | undefined>(undefined);
  // Each page's own natural PDF-point size, fetched once up front from the
  // loaded document (pdfjs's getPage() reads just that page's dictionary —
  // cheap, no rendering) — needed before any page has actually rendered, so
  // every placeholder can reserve its real height and nothing ever jumps.
  const [pageSizes, setPageSizes] = useState<{ width: number; height: number }[] | undefined>(undefined);
  // Which pages have ever been within RENDER_WINDOW_MARGIN of the viewport
  // — see this constant's own comment for why membership is one-way.
  // Seeded with a window around initialPage up front (rather than via an
  // effect) so the very first paint already knows what to mount — whether
  // that's page 1 or wherever Continue Reading left off.
  const [renderedPages, setRenderedPages] = useState<Set<number>>(
    () => new Set([initialPage - 1, initialPage, initialPage + 1].filter((p) => p >= 1))
  );
  // The page the toolbar shows as "current" — driven by scroll position
  // (CURRENT_PAGE_ROOT_MARGIN's observer), not by which page(s) happen to
  // be mounted.
  const [currentPage, setCurrentPage] = useState(initialPage);
  // User-facing zoom, 1 = "100%" = fit-to-width (see fitScale below) —
  // not a direct multiplier of the PDF's own native page-unit size.
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | undefined>(undefined);

  // The actual available width of the box pages render into, in CSS px
  // (measured, not guessed — this box's width depends on
  // --pdf-reader-max-width, its own padding/border, and the viewport,
  // none of which are worth duplicating here). Needed, with pageSizes[0]'s
  // width, to compute fitScale below.
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef(new Map<number, HTMLDivElement>());
  const touchStartRef = useRef<{ x: number; y: number; time: number; scrollLeft: number } | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didInitialScroll = useRef(false);

  // Tracks the *inner* (unpadded) box's width live, so fit-to-width stays
  // correct across viewport resizes and reading-width/PDF-column changes,
  // not just on first render.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const url = `${BASE_PATH}/pdf/${file}`;

  // The scale (PDF points → CSS px) that makes a page exactly as wide as
  // its container — i.e. "fit width" — computed from real measurements
  // rather than assuming the PDF's own page-unit size happens to match
  // the available column (it doesn't, reliably: see PDF-CONTENT.md §1 on
  // these scans' page geometry). All pages of a given Surah's PDF share
  // the same width (confirmed in PDF-CONTENT.md's generation pipeline),
  // so page 1's width stands in for the whole document. Falls back to 1
  // (i.e. `zoom` alone) until both measurements are in, on the very first
  // render before layout runs.
  const pageNaturalWidth = pageSizes?.[0]?.width;
  const fitScale = containerWidth && pageNaturalWidth ? containerWidth / pageNaturalWidth : 1;
  const renderScale = fitScale * zoom;

  function markRendered(pages: number[]) {
    setRenderedPages((prev) => {
      if (pages.every((p) => prev.has(p))) return prev;
      const next = new Set(prev);
      for (const p of pages) next.add(p);
      return next;
    });
  }

  // Prev/Next/swipe/"Go to page" all reduce to this: the target page
  // already exists in the column (every page's wrapper is always
  // rendered, even before its own <Page> has mounted — only its real
  // height depends on pageSizes), so scrolling to it is instant and
  // correct even for a page that hasn't rendered yet — pre-marking it (and
  // its immediate neighbors) rendered here just means its canvas is
  // already mounting by the time the scroll animation finishes, rather
  // than waiting for RENDER_WINDOW_MARGIN's observer to notice.
  function scrollToPage(page: number, behavior: ScrollBehavior = "smooth") {
    if (!numPages) return;
    const clamped = Math.min(Math.max(1, page), numPages);
    markRendered([clamped - 1, clamped, clamped + 1].filter((p) => p >= 1 && p <= numPages));
    pageRefs.current.get(clamped)?.scrollIntoView({ behavior, block: "start" });
  }

  function zoomBy(step: number) {
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z + step).toFixed(2))));
  }

  // Left/right swipe = Prev/Next (Readme.md's mobile-reading-experience
  // requirement) — direction matches the toolbar's own "← Prev"/"Next →"
  // arrows: a leftward swipe (finger moving right-to-left) goes forward,
  // same motion as swiping to the next photo in a gallery. Only touchstart/
  // touchend are needed (no touchmove): starting state is captured, native
  // touch-scrolling (the container's own overflowX: auto) runs completely
  // undisturbed for the whole gesture since nothing here ever calls
  // preventDefault, and the end handler just measures what happened.
  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      scrollLeft: containerRef.current?.scrollLeft ?? 0,
    };
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const touch = e.changedTouches[0];
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Date.now() - start.time > SWIPE_MAX_DURATION_MS) return;
    if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE_PX) return;
    if (Math.abs(deltaX) < Math.abs(deltaY) * SWIPE_MIN_HORIZONTAL_RATIO) return;

    const el = containerRef.current;
    const maxScrollLeft = el ? el.scrollWidth - el.clientWidth : 0;
    const wasAtRightEdge = start.scrollLeft >= maxScrollLeft - SWIPE_EDGE_SLACK_PX;
    const wasAtLeftEdge = start.scrollLeft <= SWIPE_EDGE_SLACK_PX;

    if (deltaX < 0 && wasAtRightEdge) scrollToPage(currentPage + 1);
    else if (deltaX > 0 && wasAtLeftEdge) scrollToPage(currentPage - 1);
  }

  // Once every page's real size is known, jump straight to initialPage
  // (Continue Reading resuming mid-Surah) — instantly, not smoothly: this
  // is establishing where the reader already was, not a navigation action.
  // Runs once (didInitialScroll) — later zoom changes reflow pageSizes-
  // derived heights but must never re-trigger this jump. The scroll (and
  // its own setState, marking more pages rendered) happens in a callback
  // rather than directly in the effect body — an animation frame after
  // the heights that make it land correctly have actually painted.
  useEffect(() => {
    if (didInitialScroll.current || !numPages || !pageSizes || initialPage <= 1) return;
    didInitialScroll.current = true;
    const raf = requestAnimationFrame(() => scrollToPage(initialPage, "auto"));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages, pageSizes]);

  // Lazy-mounts each page's real <Page> only once it comes within
  // RENDER_WINDOW_MARGIN of the viewport (see that constant's comment).
  // Re-runs whenever the set of page wrapper elements changes (i.e. once
  // numPages is first known and they're all rendered).
  useEffect(() => {
    if (!numPages) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const nowNear = entries
          .filter((e) => e.isIntersecting)
          .map((e) => Number(e.target.getAttribute("data-page-number")))
          .filter((p) => p > 0);
        if (nowNear.length > 0) markRendered(nowNear);
      },
      { rootMargin: RENDER_WINDOW_MARGIN, threshold: 0 }
    );
    for (const el of pageRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [numPages]);

  // Continue Reading equivalent for PDF Mode (see onPageChange's own doc
  // comment) — same rootMargin/topmost-wins/debounce idiom as
  // AyahList.tsx's ayah tracking, one level up.
  useEffect(() => {
    if (!numPages) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
        const pageNum = Number(topMost.target.getAttribute("data-page-number"));
        if (!pageNum) return;
        setCurrentPage(pageNum);

        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(() => onPageChange?.(pageNum), 800);
      },
      { rootMargin: CURRENT_PAGE_ROOT_MARGIN, threshold: 0 }
    );
    for (const el of pageRefs.current.values()) observer.observe(el);
    return () => {
      observer.disconnect();
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [numPages, onPageChange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
      <PdfToolbar currentPage={currentPage} numPages={numPages} zoom={zoom} goToPage={scrollToPage} zoomBy={zoomBy} sticky />

      {/* Outer frame: fills the full width the reader column gives it
          (see SurahReader.tsx's --pdf-reader-max-width) — no maxWidth cap
          of its own, so fitScale above is computed against the real
          available space, not an arbitrary inner limit. The inner div is
          the actual ResizeObserver target and the only horizontally-
          scrollable element (one shared horizontal scroll for the whole
          column — every page is the same natural width, so panning while
          zoomed applies uniformly page after page, same as any continuous-
          scroll PDF viewer): at zoom 100% pages exactly fill it (no
          scrollbar); scrolling only kicks in once a user deliberately
          zooms past fit-width, which is expected, not a bug. Vertical
          scrolling is the ordinary page scroll (window-level, like the
          rest of this reader) — this div never constrains page height. */}
      <div
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "0.5rem",
          padding: "0.5rem",
          background: "var(--color-bg)",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div
          ref={containerRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ width: "100%", overflowX: "auto" }}
        >
          <Document
            file={url}
            loading={<PdfPlaceholder label="Loading Surah…" />}
            error={<PdfPlaceholder label="This Surah's PDF couldn't be loaded." />}
            onLoadSuccess={(pdf) => {
              setError(undefined);
              setNumPages(pdf.numPages);
              Promise.all(
                Array.from({ length: pdf.numPages }, (_, i) =>
                  pdf.getPage(i + 1).then((p) => ({ width: p.view[2] - p.view[0], height: p.view[3] - p.view[1] }))
                )
              ).then(setPageSizes);
            }}
            onLoadError={(e) => setError(e.message)}
          >
            {numPages &&
              Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <PdfPageSlot
                  key={pageNum}
                  pageNum={pageNum}
                  isLast={pageNum === numPages}
                  height={pageSizes ? pageSizes[pageNum - 1].height * renderScale : undefined}
                  rendered={renderedPages.has(pageNum)}
                  renderScale={renderScale}
                  registerRef={(el) => {
                    // Same runtime-safe ref-map pattern as AyahBlock.tsx's
                    // own `registerRef` prop (ayahRefs there, pageRefs
                    // here) — a ref callback only ever actually runs at
                    // commit time, never during render, regardless of
                    // where its definition is lexically written; the
                    // lint rule can't see that once it's threaded through
                    // an ordinary prop like this rather than JSX's own
                    // `ref=` attribute directly.
                    // eslint-disable-next-line react-hooks/refs
                    if (el) pageRefs.current.set(pageNum, el);
                    else pageRefs.current.delete(pageNum);
                  }}
                />
              ))}
          </Document>
        </div>
      </div>

      {/* Footer nav — the same Prev/Next/Zoom as the toolbar above, plus a
          jump-to-page ("Page Index") control, so a reader who has scrolled
          down into a zoomed-in page never has to scroll back up just to
          move on (JumpToAyah.tsx is text mode's equivalent: label + number
          input + Go, not a page reload). */}
      <PdfToolbar currentPage={currentPage} numPages={numPages} zoom={zoom} goToPage={scrollToPage} zoomBy={zoomBy}>
        <PdfPageJump numPages={numPages} goToPage={scrollToPage} />
      </PdfToolbar>

      {error && (
        <p role="alert" style={{ color: "var(--color-accent-text)", fontSize: "0.85rem" }}>
          {error}
        </p>
      )}
    </div>
  );
}

type PdfToolbarProps = {
  currentPage: number;
  numPages: number | undefined;
  zoom: number;
  goToPage: (page: number) => void;
  zoomBy: (step: number) => void;
  /** Only the footer passes a PdfPageJump child — the top toolbar keeps
      its plain "Page X of Y" label, so the jump control isn't shown twice
      for one PDF. */
  children?: ReactNode;
  /** The top toolbar only — continuous scroll (Readme.md) means a Surah
      can run to dozens of pages, so without this Prev/Next/Zoom would
      scroll out of reach entirely rather than needing a scroll back to
      the top. Stacks sticky directly beneath ReaderNavBar's own sticky
      "top" row (see --reader-navbar-height's own comment in globals.css
      for the full stack: SiteHeader, then ReaderNavBar, then this). The
      footer copy (after all pages) doesn't need this — it's already
      exactly where a reader who scrolled to the end naturally lands. */
  sticky?: boolean;
};

function PdfToolbar({ currentPage, numPages, zoom, goToPage, zoomBy, children, sticky }: PdfToolbarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: "0.75rem",
        fontSize: "0.85rem",
        width: "100%",
        ...(sticky
          ? {
              position: "sticky" as const,
              top: "calc(var(--site-header-height) + var(--reader-navbar-height))",
              zIndex: 30,
              background: "var(--color-bg)",
              padding: "0.5rem 0",
              borderBottom: "1px solid var(--color-border)",
            }
          : {}),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} style={pdfButtonStyle}>
          ← Prev
        </button>
        <span style={{ color: "var(--color-text-muted)" }}>
          Page {currentPage}
          {numPages ? ` of ${numPages}` : ""}
        </span>
        <button
          type="button"
          onClick={() => goToPage(currentPage + 1)}
          disabled={!numPages || currentPage >= numPages}
          style={pdfButtonStyle}
        >
          Next →
        </button>
      </div>
      {children}
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <button type="button" onClick={() => zoomBy(-ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} aria-label="Zoom out" style={pdfButtonStyle}>
          −
        </button>
        <span style={{ color: "var(--color-text-muted)", minWidth: "3ch", textAlign: "center" }}>
          {Math.round(zoom * 100)}%
        </span>
        <button type="button" onClick={() => zoomBy(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in" style={pdfButtonStyle}>
          +
        </button>
      </div>
    </div>
  );
}

/** "Go to page" — the Page Index control, footer-only (see PdfToolbar's
    `children` doc comment). Mirrors JumpToAyah.tsx's label+input+Go shape
    for the same control exactly one level up (pages, not ayahs); here it
    scrolls to a page already laid out in the continuous column rather
    than loading one. */
function PdfPageJump({ numPages, goToPage }: { numPages: number | undefined; goToPage: (page: number) => void }) {
  const inputId = useId();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!numPages) return;
    const page = Math.round(Number(value));
    if (!Number.isFinite(page) || page < 1 || page > numPages) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    goToPage(page);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
      <label htmlFor={inputId} style={{ color: "var(--color-text-muted)" }}>
        Go to page
      </label>
      <input
        id={inputId}
        type="number"
        min={1}
        max={numPages}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setInvalid(false);
        }}
        disabled={!numPages}
        aria-describedby={invalid ? `${inputId}-error` : undefined}
        style={{
          width: "4rem",
          border: "1px solid var(--color-border)",
          borderRadius: "0.25rem",
          padding: "0.25rem 0.4rem",
          background: "var(--color-bg)",
          color: "var(--color-text)",
        }}
      />
      <button type="submit" disabled={!numPages} style={pdfButtonStyle}>
        Go
      </button>
      {invalid && (
        <span id={`${inputId}-error`} role="alert" style={{ color: "var(--color-accent-text)" }}>
          Enter 1–{numPages}
        </span>
      )}
    </form>
  );
}

type PdfPageSlotProps = {
  pageNum: number;
  isLast: boolean;
  /** In CSS px, once pageSizes has loaded (see PdfViewer's own comment on
      why every page's real size is fetched up front) — undefined only
      for the brief gap before that arrives, when PdfPlaceholder falls
      back to its own default. */
  height: number | undefined;
  /** Whether this page is within RENDER_WINDOW_MARGIN of the viewport —
      see that constant's comment for what "rendered" means here. */
  rendered: boolean;
  renderScale: number;
  registerRef: (el: HTMLDivElement | null) => void;
};

/** One page's slot in the continuous column — a fixed-height wrapper
    (see `height`'s doc comment) holding either the real, lazily-mounted
    <Page> or a same-sized placeholder. Pulled out of PdfViewer's own JSX
    into its own component (mirroring AyahBlock.tsx's `registerRef` prop
    for AyahList.tsx's identical per-item ref-map pattern) rather than an
    inline ref callback in the .map() below — not just style, an inline
    `ref={(el) => { pageRefs.current... }}` there is a real lint error
    (react-hooks/refs: a ref written through directly in a JSX `ref`
    attribute is flagged as a possible render-time ref read no matter how
    it's actually invoked; passed through an ordinary, differently-named
    prop instead, as here, it isn't). */
function PdfPageSlot({ pageNum, isLast, height, rendered, renderScale, registerRef }: PdfPageSlotProps) {
  return (
    <div ref={registerRef} data-page-number={pageNum} style={{ marginBottom: isLast ? 0 : "1rem" }}>
      {rendered ? (
        <Page
          pageNumber={pageNum}
          scale={renderScale}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          loading={<PdfPlaceholder label="Rendering…" height={height} />}
          error={<PdfPlaceholder label="This page couldn't be loaded." height={height} />}
        />
      ) : (
        <PdfPlaceholder label="" height={height} />
      )}
    </div>
  );
}

/** A page not yet rendered (still outside RENDER_WINDOW_MARGIN), a page
    whose canvas is actively rasterizing, or the whole-document load/error
    state. `height` reserves the exact space that page's real content will
    take (known up front from pageSizes) so nothing ever shifts as
    placeholders swap for real canvases; omitted only for the
    whole-document case, where no single page size applies. Deliberately
    `width: 100%` of whatever contains it (PdfPageSlot's own wrapper, or
    the scroll container directly for the whole-document case) rather
    than a fixed guess: a fixed width here that doesn't exactly match a
    real rendered <Page>'s own (fit-to-width, so it varies with container
    size and zoom) width would make the two disagree — and with dozens of
    placeholder pages still unrendered at any moment in a long Surah's
    continuous scroll, EVERY one of them wider than the real pages is
    exactly what forced a horizontal scrollbar even at "100%"/fit-width,
    not a zoom level actually wider than the column. */
function PdfPlaceholder({ label, height }: { label: string; height?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: height ?? "60vh",
        width: "100%",
        color: "var(--color-text-muted)",
        fontSize: "0.9rem",
      }}
    >
      {label}
    </div>
  );
}

const pdfButtonStyle = {
  border: "1px solid var(--color-border)",
  borderRadius: "0.25rem",
  padding: "0.25rem 0.65rem",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
} as const;
