"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { AnnotationLayer } from "./AnnotationLayer";
import { PdfToolbar } from "./PdfToolbar";
import type { Annotation, AnnotationTool } from "./annotationTypes";
import { TOOL_COLORS, newAnnotationId } from "./annotationTypes";

// pdf.js's getDocument() does its own fetch/XHR for these three asset
// paths — unlike next/link or next/image, Next's `basePath` config does
// NOT auto-prefix arbitrary string literals passed to third-party code,
// so this needs its own explicit prefix via a client-exposed env var
// (NEXT_PUBLIC_BASE_PATH, set alongside next.config.ts's server-side
// NEXT_BASE_PATH — client components can only read NEXT_PUBLIC_* vars).
// Empty string when unset (local dev, bare-origin deploys), matching
// next.config.ts's own `|| undefined` fallback.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type PdfViewerProps = {
  url: string | null;
  className?: string;
  /** Page to open on first load (e.g. a lesson's page_start). Defaults to 1. */
  initialPage?: number;
  /**
   * Controlled mode: when provided, this page always wins (e.g. the
   * student's /share/[lessonId] view following the tutor's broadcast page).
   * Omit for plain, self-contained navigation (e.g. the Materials preview).
   */
  page?: number;
  /** Called whenever the *user* changes the page via the Prev/Next buttons. */
  onPageChange?: (page: number) => void;
  /**
   * Minimal follower view (student live-follow): no page nav, no annotation
   * tools — just fullscreen + zoom for readability. See docs/PROGRESS.md.
   */
  readOnly?: boolean;
};

const MIN_SCALE = 0.4;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.2;
const DEFAULT_SCALE = 1.1;

// Scroll-to-turn-page tuning (see the wheel/touch effect below):
// how close to the edge counts as "at the boundary" (subpixel rounding),
// how long to ignore further boundary-triggered turns after one fires (so a
// single wheel fling or momentum scroll can't cascade through several pages),
// and how far a touch drag past the boundary counts as an intentional turn
// rather than an incidental overscroll bounce.
const SCROLL_BOUNDARY_EPSILON = 2;
const SCROLL_TURN_LOCK_MS = 500;
const TOUCH_TURN_THRESHOLD = 45;

type AnnotationsByPage = Record<number, Annotation[]>;

export function PdfViewer({ url, className, initialPage, page, onPageChange, readOnly }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // The actual scrolling element (containerRef is the outer shell, sized for
  // the fit-to-screen calc below) — the wheel/touch page-turn effect reads
  // and sets scroll position on this one.
  const scrollRef = useRef<HTMLDivElement>(null);
  // Sized imperatively (not just via the `renderSize` style below) so a
  // scroll-triggered page turn can read back an already-correct
  // `scrollHeight` synchronously, without waiting on a React commit — see
  // the render effect.
  const pageWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageNum, setPageNum] = useState(initialPage ?? 1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [baseSize, setBaseSize] = useState({ width: 0, height: 0 });
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(true);
  // Brief fade while a page (re)renders — covers page turns, zoom changes,
  // and the initial page — kept short so it reads as a transition, not a
  // loading state.
  const [pageSettling, setPageSettling] = useState(false);

  // Which edge the new page should open scrolled to: "top" for a forward
  // turn (Next button, or scrolling down past the bottom), "bottom" for a
  // backward one (Prev button, or scrolling up past the top) — mirrors how
  // a continuous document reader flows into the next/previous page.
  const pendingScrollAnchorRef = useRef<"top" | "bottom" | null>(null);
  // While true, a boundary scroll/drag is ignored — set right after a
  // scroll-triggered page turn so one wheel fling or momentum scroll can't
  // cascade through multiple pages.
  const scrollLockRef = useRef(false);
  const scrollLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const docRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<import("pdfjs-dist").PDFDocumentLoadingTask | null>(null);
  // pdf.js refuses to run a second render() on the same canvas while one is
  // still in flight — cancel the previous task before starting a new one
  // (e.g. the auto-fit rescale below can trigger a rapid second pass).
  const renderTaskRef = useRef<ReturnType<import("pdfjs-dist").PDFPageProxy["render"]> | null>(null);
  // Auto-shrink to fit narrow containers (mobile) on first load only — never
  // fights a zoom level the user picked afterward. Reset per new document.
  const hasAutoFittedRef = useRef(false);

  // ---- Annotations (per-viewer-session only — see docs/PROGRESS.md scope note) ----
  const [activeTool, setActiveTool] = useState<AnnotationTool>("select");
  const [color, setColor] = useState<string>(TOOL_COLORS[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [annotationsByPage, setAnnotationsByPage] = useState<AnnotationsByPage>({});
  const historyRef = useRef<{ stack: AnnotationsByPage[]; index: number }>({ stack: [{}], index: 0 });
  // Mirrors historyRef's shape purely so canUndo/canRedo can be read during
  // render (reading ref.current directly during render isn't allowed).
  const [historyMeta, setHistoryMeta] = useState({ index: 0, length: 1 });

  const pushHistory = useCallback((next: AnnotationsByPage) => {
    const h = historyRef.current;
    const trimmed = h.stack.slice(0, h.index + 1);
    trimmed.push(next);
    historyRef.current = { stack: trimmed, index: trimmed.length - 1 };
    setHistoryMeta({ index: trimmed.length - 1, length: trimmed.length });
    setAnnotationsByPage(next);
  }, []);

  // Controlled mode: an external page (e.g. a live broadcast) always wins.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (page !== undefined && page !== pageNum) setPageNum(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function goToPage(next: number, anchor: "top" | "bottom" = "top") {
    pendingScrollAnchorRef.current = anchor;
    setPageNum(next);
    setSelectedId(null);
    onPageChange?.(next);
  }

  // Shared by the wheel and touch handlers below: turn one page in
  // `direction`, opening the new page scrolled to the edge the user is
  // arriving from, and lock out further scroll-triggered turns briefly.
  function turnPageByScroll(direction: 1 | -1) {
    const next = pageNum + direction;
    if (next < 1 || next > numPages) return;
    scrollLockRef.current = true;
    if (scrollLockTimeoutRef.current) clearTimeout(scrollLockTimeoutRef.current);
    scrollLockTimeoutRef.current = setTimeout(() => {
      scrollLockRef.current = false;
    }, SCROLL_TURN_LOCK_MS);
    goToPage(next, direction === 1 ? "top" : "bottom");
  }

  // Direct "jump to page N" input — kept as free-typed text so a user can
  // clear the field and retype rather than fighting a clamped number input
  // on every keystroke; clamped only once they commit (Enter/blur).
  const [pageInput, setPageInput] = useState(String(pageNum));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPageInput(String(pageNum));
  }, [pageNum]);

  function commitPageInput() {
    const parsed = Number(pageInput);
    if (Number.isInteger(parsed) && numPages > 0) {
      goToPage(Math.min(numPages, Math.max(1, parsed)));
    } else {
      setPageInput(String(pageNum));
    }
  }

  // Reset annotations + history whenever a new document loads.
  useEffect(() => {
    historyRef.current = { stack: [{}], index: 0 };
    hasAutoFittedRef.current = false;
    pendingScrollAnchorRef.current = null;
    if (scrollLockTimeoutRef.current) clearTimeout(scrollLockTimeoutRef.current);
    scrollLockRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistoryMeta({ index: 0, length: 1 });
    setAnnotationsByPage({});
    setSelectedId(null);
  }, [url]);

  // Clear any pending scroll-turn-lock timer on unmount.
  useEffect(() => {
    return () => {
      if (scrollLockTimeoutRef.current) clearTimeout(scrollLockTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!url) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    setLoading(true);

    (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();

      try {
        const loadingTask = pdfjsLib.getDocument({
          url,
          // Without these, pdf.js can't find its WASM image codecs (JBIG2 /
          // OpenJPEG — pdfjs-dist v6 moved these off pure-JS) or its standard
          // font / CMap data. It doesn't error when that happens — it just
          // silently drops whatever it can't decode. A scanned/image-based
          // PDF page (e.g. a bitmapped Quran Mushaf page compressed as
          // JBIG2) then renders as a blank page with only its vector text
          // (headers, footers, page numbers) visible — easy to mistake for a
          // pagination bug since the page *count* and navigation are fine.
          // Paths are served from public/pdfjs/, synced from node_modules by
          // scripts/copy-pdfjs-assets.mjs (see that script's header comment).
          // BASE_PATH-prefixed (see module-level comment above) — public/
          // folder assets are NOT auto-prefixed by Next's basePath config.
          wasmUrl: `${BASE_PATH}/pdfjs/wasm/`,
          standardFontDataUrl: `${BASE_PATH}/pdfjs/standard_fonts/`,
          cMapUrl: `${BASE_PATH}/pdfjs/cmaps/`,
          cMapPacked: true,
        });
        loadingTaskRef.current = loadingTask;
        const doc = await loadingTask.promise;
        if (!active) return;
        docRef.current = doc;
        setNumPages(doc.numPages);
        setPageNum(initialPage ?? page ?? 1);
        setLoading(false);
      } catch (err) {
        console.warn("PdfViewer failed to load document:", err);
        if (active) {
          setError("Couldn't load this PDF.");
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
      loadingTaskRef.current?.destroy();
      loadingTaskRef.current = null;
      docRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    let cancelled = false;
    setPageSettling(true);

    (async () => {
      const page = await doc.getPage(pageNum);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      setBaseSize({ width: base.width, height: base.height });

      // Shrink to fit a narrow (mobile) container on first load, rather than
      // rendering oversized and relying on horizontal panning to read it.
      let effectiveScale = scale;
      if (!hasAutoFittedRef.current) {
        hasAutoFittedRef.current = true;
        const containerWidth = containerRef.current?.clientWidth;
        if (containerWidth) {
          const fitScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, (containerWidth - 48) / base.width));
          if (fitScale < scale) {
            effectiveScale = fitScale;
            setScale(fitScale);
          }
        }
      }

      const viewport = page.getViewport({ scale: effectiveScale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setRenderSize({ width: viewport.width, height: viewport.height });
      // Mirror the same size directly onto the DOM node (not just via the
      // `renderSize` state/style above) so the scroll-anchor logic just
      // below can read back an accurate `scrollHeight` right away, instead
      // of racing the state update's next React commit.
      if (pageWrapRef.current) {
        pageWrapRef.current.style.width = `${viewport.width}px`;
        pageWrapRef.current.style.height = `${viewport.height}px`;
      }

      const anchor = pendingScrollAnchorRef.current;
      if (anchor && scrollRef.current) {
        pendingScrollAnchorRef.current = null;
        scrollRef.current.scrollTop = anchor === "top" ? 0 : scrollRef.current.scrollHeight;
      }

      const context = canvas.getContext("2d");
      if (!context) return;

      renderTaskRef.current?.cancel();
      const task = page.render({ canvasContext: context, viewport, canvas });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch (err) {
        // A cancelled render rejects by design — anything else is real.
        const name = err instanceof Error ? err.name : "";
        if (name !== "RenderingCancelledException") throw err;
      } finally {
        if (!cancelled) setPageSettling(false);
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [pageNum, scale, numPages]);

  function fitToScreen() {
    const containerWidth = containerRef.current?.clientWidth;
    if (!containerWidth || !baseSize.width) return;
    const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, (containerWidth - 48) / baseSize.width));
    setScale(next);
  }

  function resetView() {
    setScale(DEFAULT_SCALE);
  }

  function toggleFullscreen() {
    setFullscreen((v) => !v);
  }

  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // Scroll-to-turn-page: mouse wheel, trackpad, and touch. Only for
  // interactive views — a read-only follower's page is driven entirely by
  // the tutor's broadcast, so it has nothing of its own to scroll-turn to.
  // Also only while the "select" tool is active: a touch drag is otherwise
  // ambiguous with drawing a freehand/rect/arrow annotation, and on a page
  // that fits the viewport without scrolling (so it's trivially "at both
  // boundaries" already) any vertical stroke would otherwise get read as a
  // page-turn swipe instead of a drawing gesture.
  useEffect(() => {
    const el = scrollRef.current;
    // `loading` guards the brief window before the first page has actually
    // sized `pageWrapRef` — without it, scrollHeight/clientHeight both read
    // as ~0 (trivially "at both boundaries"), which could turn a page before
    // its content has even appeared.
    if (!el || readOnly || loading || numPages <= 0 || activeTool !== "select") return;

    function atTop() {
      return el!.scrollTop <= SCROLL_BOUNDARY_EPSILON;
    }
    function atBottom() {
      return el!.scrollTop + el!.clientHeight >= el!.scrollHeight - SCROLL_BOUNDARY_EPSILON;
    }

    function onWheel(e: WheelEvent) {
      const wantsNext = e.deltaY > 0 && atBottom() && pageNum < numPages;
      const wantsPrev = e.deltaY < 0 && atTop() && pageNum > 1;
      if (!wantsNext && !wantsPrev) return; // ordinary in-page scroll — let it through
      e.preventDefault();
      if (scrollLockRef.current) return;
      turnPageByScroll(wantsNext ? 1 : -1);
    }

    // Touch scrolling never fires `wheel`, so the boundary drag is tracked
    // by hand: how far the finger has moved since touchstart, in the
    // direction that (at a boundary) means "turn the page" rather than
    // "bounce/rubber-band at the edge".
    let touchStartY: number | null = null;
    let touchTurned = false;

    function onTouchStart(e: TouchEvent) {
      touchStartY = e.touches[0]?.clientY ?? null;
      touchTurned = false;
    }

    function onTouchMove(e: TouchEvent) {
      if (touchStartY == null || touchTurned) return;
      const y = e.touches[0]?.clientY;
      if (y == null) return;
      const dy = y - touchStartY; // positive = finger dragged down = scrolling up

      if (dy > TOUCH_TURN_THRESHOLD && atTop() && pageNum > 1) {
        e.preventDefault();
        touchTurned = true;
        if (!scrollLockRef.current) turnPageByScroll(-1);
      } else if (dy < -TOUCH_TURN_THRESHOLD && atBottom() && pageNum < numPages) {
        e.preventDefault();
        touchTurned = true;
        if (!scrollLockRef.current) turnPageByScroll(1);
      }
    }

    function onTouchEnd() {
      touchStartY = null;
      touchTurned = false;
    }

    // `passive: false` so preventDefault actually suppresses the native
    // scroll/bounce for the boundary tick that instead turns the page.
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNum, numPages, readOnly, activeTool, loading]);

  const pageAnnotations = annotationsByPage[pageNum] ?? [];

  function commitAnnotation(a: Annotation) {
    const full = { ...a, page: pageNum };
    const next = { ...annotationsByPage, [pageNum]: [...(annotationsByPage[pageNum] ?? []), full] };
    pushHistory(next);
  }

  function commitText(point: { x: number; y: number }, text: string) {
    commitAnnotation({ id: newAnnotationId(), page: pageNum, tool: "text", color, strokeWidth: 3, box: { x: point.x, y: point.y, w: 1, h: 1 }, text });
  }

  function eraseAnnotation(id: string) {
    const next = { ...annotationsByPage, [pageNum]: (annotationsByPage[pageNum] ?? []).filter((a) => a.id !== id) };
    pushHistory(next);
    if (selectedId === id) setSelectedId(null);
  }

  function deleteSelected() {
    if (selectedId) eraseAnnotation(selectedId);
  }

  function clearAllOnPage() {
    const next = { ...annotationsByPage, [pageNum]: [] };
    pushHistory(next);
    setSelectedId(null);
  }

  function undo() {
    const h = historyRef.current;
    if (h.index <= 0) return;
    h.index -= 1;
    setHistoryMeta({ index: h.index, length: h.stack.length });
    setAnnotationsByPage(h.stack[h.index]);
  }

  function redo() {
    const h = historyRef.current;
    if (h.index >= h.stack.length - 1) return;
    h.index += 1;
    setHistoryMeta({ index: h.index, length: h.stack.length });
    setAnnotationsByPage(h.stack[h.index]);
  }

  // Keyboard delete for the currently-selected annotation.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && document.activeElement?.tagName !== "INPUT") {
        deleteSelected();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, annotationsByPage]);

  if (!url) return null;

  if (error) return <p className="p-6 text-sm text-danger">{error}</p>;

  return (
    <div
      ref={containerRef}
      className={
        fullscreen
          ? `fixed inset-0 z-[100] flex flex-col bg-paper`
          : `flex flex-col rounded-[var(--radius-m)] border border-line bg-surface ${className ?? ""}`
      }
    >
      {!readOnly && toolbarOpen && (
        <PdfToolbar
          activeTool={activeTool}
          onToolChange={(t) => {
            setActiveTool(t);
            setSelectedId(null);
          }}
          color={color}
          onColorChange={setColor}
          onUndo={undo}
          onRedo={redo}
          canUndo={historyMeta.index > 0}
          canRedo={historyMeta.index < historyMeta.length - 1}
          onClearAll={clearAllOnPage}
          onDeleteSelected={deleteSelected}
          hasSelection={!!selectedId}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="flex items-center gap-2">
          {!readOnly && !toolbarOpen && (
            <Button variant="ghost" size="sm" title="Show annotation tools" onClick={() => setToolbarOpen(true)}>
              🛠 Tools
            </Button>
          )}
          {!readOnly && toolbarOpen && (
            <Button variant="ghost" size="sm" title="Hide annotation tools" onClick={() => setToolbarOpen(false)}>
              ▴ Hide tools
            </Button>
          )}
          {!readOnly && (
            <>
              <Button variant="ghost" size="sm" title="Previous page" onClick={() => goToPage(Math.max(1, pageNum - 1))} disabled={pageNum <= 1}>
                ◀
              </Button>
              <span className="flex items-center gap-1 text-xs text-muted">
                Page{" "}
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Go to page"
                  title="Go to page"
                  value={pageInput}
                  disabled={numPages <= 0}
                  onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ""))}
                  onBlur={commitPageInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setPageInput(String(pageNum));
                  }}
                  className="w-10 rounded border border-line bg-surface px-1 py-0.5 text-center text-xs disabled:opacity-50"
                />{" "}
                of {numPages || "…"}
              </span>
              <Button variant="ghost" size="sm" title="Next page" onClick={() => goToPage(Math.min(numPages, pageNum + 1))} disabled={pageNum >= numPages}>
                ▶
              </Button>
            </>
          )}
          {readOnly && (
            <span className="text-xs text-muted">
              Page {pageNum} of {numPages || "…"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" title="Zoom out" onClick={() => setScale((s) => Math.max(MIN_SCALE, s - ZOOM_STEP))}>
            −
          </Button>
          <span className="w-10 text-center text-xs text-muted">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="sm" title="Zoom in" onClick={() => setScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP))}>
            +
          </Button>
          <Button variant="ghost" size="sm" title="Fit to screen" onClick={fitToScreen}>
            ⤢
          </Button>
          <Button variant="ghost" size="sm" title="Reset view" onClick={resetView}>
            ⟳
          </Button>
          <Button variant="outline" size="sm" title={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen}>
            {fullscreen ? "✕ Exit" : "⛶ Full Screen"}
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className={`relative flex-1 overflow-auto bg-paper-alt p-4 ${fullscreen ? "" : "max-h-[75vh]"}`}>
        {loading && (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-sm text-muted">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading lesson material…
          </div>
        )}
        <div
          ref={pageWrapRef}
          className={`relative mx-auto transition-opacity duration-150 ${pageSettling ? "opacity-60" : "opacity-100"}`}
          style={{ width: renderSize.width || undefined, height: renderSize.height || undefined, display: loading ? "none" : undefined }}
        >
          <canvas ref={canvasRef} className="block" />
          {!readOnly && baseSize.width > 0 && (
            <AnnotationLayer
              pageSize={baseSize}
              renderSize={renderSize}
              annotations={pageAnnotations}
              activeTool={activeTool}
              color={color}
              strokeWidth={3}
              selectedId={selectedId}
              onCommit={commitAnnotation}
              onSelect={setSelectedId}
              onErase={eraseAnnotation}
              onTextCommit={commitText}
            />
          )}
        </div>
      </div>
    </div>
  );
}
