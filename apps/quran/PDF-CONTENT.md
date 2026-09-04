# PDF-CONTENT — PDF Mode source, pipeline, and how to update it

How "PDF Mode" (Readme.md's requirement for an opt-in, zero-typography-risk reading view showing the *original scanned Mushaf pages* instead of rendered text) is built, and how to regenerate it if the source PDFs ever change. Companion to `QURAN-CONTENT.md` (the text/translation content pipeline) — this document covers the separate, PDF-image content pipeline only.

## 1. Source

30 scanned Juz ("Para") PDFs, one per Juz, supplied directly (not fetched from an API): `apps/quran/pdf/Holy-Quran-Para-1.pdf` .. `-30.pdf` ("Quran Majeed Redrafted And Checked", originally distributed by www.Islamicnet.com). **Gitignored, not committed** — `.pdf-build/juz/` (a strict superset: same scans, watermark removed) is a gitignored intermediate build artifact only (§2/§8; there is no Juz-level PDF Mode); this raw folder is kept locally only as the working source for regenerating `public/pdf/surah/` if it's ever replaced. Confirmed directly (via `pdf-lib`/`pdfjs-dist`, not assumed):

- **Scanned images, no real text layer.** Each page's actual Quran content is a `CCITTFaxDecode` (1-bit fax) image XObject. The only extractable text is a promotional watermark (§3) — there is no Arabic text layer to search, OCR, or accidentally corrupt.
- **Page numbering does not follow the standard 604-page Madani Mushaf pagination** already used elsewhere in this app (`chapters.json`'s `pages` field, sourced from the Quran Foundation API). E.g. `Para-1.pdf` has 28 pages against a 21-page standard span for Juz 1; `Para-30.pdf` has 30 real content pages plus 13 pages of back matter. Surah boundaries inside these specific files had to be established by direct visual inspection (§4), not formula.

## 2. Pipeline overview

There is no Juz-level PDF Mode — Juz Mode (the whole `/juz` browsing
feature, text and PDF alike) was removed entirely; per-Surah PDF is the
only PDF Mode this app serves. The per-Juz files below are purely an
intermediate build artifact of generating those per-Surah PDFs — never
served, never committed.

```
apps/quran/pdf/Holy-Quran-Para-{1..30}.pdf   (source, untouched, not served)
        │  scripts/pdf/strip-watermark.mjs
        ▼
.pdf-build/juz/para-{1..30}.pdf              (gitignored intermediate — not served)
        │  scripts/pdf/generate-surah-pdfs.mjs
        │  (reads scripts/pdf/surah-page-map.json)
        ▼
public/pdf/surah/{1..114}.pdf                (served — per-Surah PDF Mode)
        +
src/content/generated/pdf-manifest.json     (page counts, read by lib/content/pdf.ts)
```

Both scripts are developer-run, on-demand (`npm run pdf:strip-watermark`, `npm run pdf:generate`) — like `sync-content.mjs`, this is static content that changes only when someone deliberately updates it and commits the result, not a `next build`/CI step. Run `pdf:strip-watermark` before `pdf:generate` if `.pdf-build/juz/` doesn't exist locally yet (it's gitignored, regenerated on demand, not part of a fresh checkout).

## 3. Watermark removal (`scripts/pdf/strip-watermark.mjs`)

(Output moved from the originally-served `public/pdf/juz/` to the gitignored
`.pdf-build/juz/` intermediate directory once Juz Mode was removed — see §8.)

Every page carries a non-Quran promotional watermark ("www.Islamicnet.com" / "Learn quran online with Tajweed from..."). Confirmed structure: it's added by Adobe Acrobat's batch "Add Header and Footer" feature — one shared `/Header` Form XObject and one shared `/Footer` Form XObject per file (tagged `/PieceInfo/ADBE_CompoundType/Private`), referenced by every page's `/Resources`, positioned in the blank top/bottom margins, **fully independent of the scanned page image** (a separate `/Im0` image XObject).

Removal empties those two Forms' content streams (`pdf-lib`) — this never touches the main content stream or the image XObject. Verified: re-parsed text content of the output contains zero occurrences of the watermark string across all 30 files; a pixel-diff of the rendered scan area before/after is 0 differing pixels.

The script de-duplicates by the underlying object *reference* before checking/stripping (not per page) — Acrobat's batch feature emits one shared Header/Footer object reused by every page in a file, not a fresh pair per page; processing per-page naively would find the object already-emptied by an earlier page and (wrongly) skip it as "no watermark found."

## 4. Surah boundary mapping (`scripts/pdf/surah-page-map.json`)

Hand/semi-hand-verified — **not** algorithmically derived, because of finding §1's pagination mismatch. Built by visually inspecting every page of all 30 Juz files (rendered via `scripts/pdf/render-preview.mjs`, a contact-sheet PNG renderer — see §6) for: any non-Quran front/back matter, and the page where each Surah's ornamental heading box (name + ayah count + revelation place, followed by Bismillah) appears. Cross-checked against the fixed, standard Surah-per-Juz order (unchanging between print editions) to catch misreads.

Shape:
```json
{
  "frontMatter": { "1": [[1, 1]] },
  "backMatter": { "30": [[31, 43]] },
  "surahs": {
    "2": { "ranges": [
      { "juz": 1, "startPage": 3, "endPage": 28 },
      { "juz": 2, "startPage": 1, "endPage": 28 },
      { "juz": 3, "startPage": 1, "endPage": 11 }
    ]}
  }
}
```
`startPage`/`endPage` are 1-based page numbers **local to that Juz PDF file** (not standard Mushaf page numbers — those don't apply here). A page where one Surah ends and the next begins mid-page (very common — the ornamental heading box often shares a page with the previous Surah's last few ayahs) is listed as both the outgoing Surah's `end` and the incoming Surah's `start` — §4a's boundary-crop mechanism is what keeps that shared page from actually showing each Surah content that isn't its own.

`Para-30.pdf`'s back matter (pages 31-43) is not thumbnail images as originally guessed from a byte-size heuristic — it's full-size appendix content (a Dua Khatm-al-Quran, tajweed/waqf symbol rules, a translation-mistakes table, Surah index tables, a closing attestation page). The boundary itself (real Quran text ends at page 30) is correct regardless.

**If the source PDFs are ever replaced/updated:** this file must be re-verified by hand against the new scans — it is not safely re-derivable by re-running a script, unlike everything else in this pipeline.

## 4a. Surah boundary cropping (`scripts/pdf/surah-boundary-crops.json`)

Mid-page boundaries (§4) mean copying a shared page whole would show each Surah content that isn't its own — the exact bug this file's crop points fix. For each such page it gives one hand-verified `splitPt`: points measured from the TOP of the page down to the first safely-blank row immediately before the incoming Surah's heading-box top border (never a formula — these scans' internal page geometry isn't on a fixed grid, same reasoning as §4). `generate-surah-pdfs.mjs` crops to that region via `pdf-lib`'s `embedPage` boundingBox (a real PDF-viewport rectangle, so the original scan pixels are completely untouched, just windowed) and composites it onto a new page, adding `CROP_BREATHING_ROOM_PT` (24pt) of genuine blank margin on whichever side(s) were actually cropped.

Three things this had to get right that a naive implementation won't:

- **A Surah entirely on one page can be sandwiched between the Surah before and after it** (several very short late-Juz-30 Surahs are — e.g. Al-Qadr (97) between Al-Alaq and Al-Bayyinah). That single physical page needs an incoming AND an outgoing bound applied *together* — a first version used two separate `setCropBox` calls and they didn't compose; the second silently replaced the first's rectangle rather than intersecting it. (This was caught only by rendering the actual generated output, not by inspecting the crop math in isolation — trust the rendered PDF over the arithmetic.)
- **The crop line sits in the ONLY blank pixels available on that page** — there's no further blank scanned margin to extend into without entering the other Surah's own content. A plain `setCropBox` at that line left text sitting flush against the reader's own page-frame chrome, reading as a screenshot cut off mid-line rather than a finished page (unlike a natural, uncropped page, which has generous margin before the scan's own ornamental frame closes it — §4b). Since that margin doesn't exist in the scan at that exact point, it's added as genuinely blank drawn canvas instead — composited the same way as §4b's merge, not a `setCropBox` tweak. Applies wherever the crop actually happened: only the top of an incoming-cropped page, only the bottom of an outgoing-cropped one, or both for the sandwiched single-page case above.
- Each crop entry records which `juz`/`page` it expects; `generate-surah-pdfs.mjs` throws (never silently mis-crops) if a Surah's actual first/last page doesn't match, so this file and `surah-page-map.json` can never drift apart unnoticed.

**If the source PDFs are ever replaced/updated:** every entry here must be re-verified by hand too (render the affected page — a fine-grained point ruler over it makes the true blank gap easy to read off exactly — and confirm the split still lands there), for the same reason as §4.

## 4b. Two-page-to-one merging (`generate-surah-pdfs.mjs`'s `decideTwoPageMerge`/`buildMergedPage`)

A Surah that only barely spills onto a second scanned page — its own boundary crop (§4a) leaves very little of the shared page for it, or it's a genuinely short Surah that just happens to straddle a page break — shouldn't force a reader to flip to "page 2 of 2" for a couple of lines. When the two pages' combined real content would comfortably fit a single page's worth of space, they're composed into ONE output page instead.

Unlike §4a's split points, this decision is **computed, not hand-verified per Surah** — it only ever composes from crop points that are already hand-verified, plus one further constant that needed its own verification: the scanned page's own ornamental frame position. That was measured directly (not assumed) by rendering sample pages from 4 different Juz files and finding the frame's solid border rule by pixel density — consistently ~74-79pt from the page top and ~677-679pt from it across all of them, i.e. a fixed print-template constant. `FRAME_TOP_DFT`/`FRAME_BOTTOM_DFT` (76/678) is that measurement; `PAGE_CONTENT_BUDGET_PT` (602) is the resulting single-page capacity two pages' content must fit inside.

Only ever applies to a Surah that is a single page-map range spanning **exactly 2** physical pages — a Surah spanning 3+ pages is out of scope regardless of how short it is. For that 2-page case:

- Each side's *used* height is its boundary-crop split point (§4a) if that side is a shared boundary, else the frame's own natural margin (`FRAME_TOP_DFT`/`FRAME_BOTTOM_DFT`) — page 1 always continues onto page 2, so it's using its full natural height on that side regardless.
- If `used1 + used2` doesn't leave at least `MERGE_SAFETY_MARGIN_PT` (5pt) of the budget spare, it's left as 2 pages. This margin exists because of a real near-miss caught during development: Al-Balad (90)'s nominal combined height came out to *exactly* the 602pt budget, but rendering and measuring the actual pixels showed it was 602.6pt — 0.6pt over, invisible in the split-point arithmetic alone. A required margin makes that kind of case fail closed (stays 2 pages) rather than risk a merged page whose content silently overflows the region it's drawn into. Trust the rendered PDF over the arithmetic, same lesson as §4a's sandwiched-page bug.
- When it does merge: `pdf-lib`'s `embedPage(page, boundingBox)` crops each source page to its own DFT region (still a real crop, never a re-render), and both are drawn at their native 1:1 scale onto one new page sized to fit them exactly, with a small fixed gap (not a divider — there's no Surah boundary here, just two photographed halves of continuous running text) between them.

As of the current source PDFs, this merges 9 Surahs (82, 86, 87, 96, 98, 99, 105, 110, 113) from 2 pages to 1; Al-Balad (90) is the one 2-page Surah that comes close but correctly stays split.

## 5. Per-Surah PDF generation (`scripts/pdf/generate-surah-pdfs.mjs`)

For each of the 114 Surahs, loads `surah-page-map.json` + the already-watermark-stripped `.pdf-build/juz/para-{n}.pdf` files, and uses `pdf-lib`'s `copyPages`/`addPage` to copy the exact page range(s) into a new, standalone PDF — a true PDF-object page copy, never a re-render/rasterize/OCR, so the original scan is preserved exactly. The Surah's overall first/last physical page is instead composited per `surah-boundary-crops.json` (§4a) wherever a boundary crop applies to it — or, where §4b's merge decision applies, both source pages are composed into one instead of copied separately. Every other page is a plain copy, unaffected. A Surah spanning multiple Juz files gets its pages copied from each source in order. Writes `public/pdf/surah/{id}.pdf` plus `src/content/generated/pdf-manifest.json` (page counts + paths, read by `src/lib/content/pdf.ts`) as its last step, so the two never drift apart.

Skips (with a loud warning, never a bogus empty file) any Surah missing a map entry — `lib/content/pdf.ts`'s `getSurahPdfInfo` returning `undefined` is how the app's PDF Mode toggle degrades gracefully (falls back to the normal text view) rather than erroring.

## 6. Inspection tooling (`scripts/pdf/render-preview.mjs`)

A one-off inspection helper (not part of the runtime app) that renders a page range from any of these PDFs into a single labeled contact-sheet PNG, for visual review (used to build §4's map, and useful again if the source PDFs are ever updated). Uses `node-canvas` (the `canvas` package) with a `drawImage` bridge, because `pdfjs-dist`'s Node code hardcodes `@napi-rs/canvas` for its own internal offscreen mask/fill canvases regardless of the canvas factory supplied to it — a real Node-pipeline incompatibility, not a config mistake. Also disables `context.clip()`: some source pages set a clip path before painting the scanned image, and node-canvas's `clip()` + pdfjs-dist's `Path2D` usage don't interact correctly in this Node pipeline (silently produces a blank canvas instead of throwing) — since this tool only trims page margins for a quick look, not the shipped viewer, clipping is simply skipped rather than debugged further. Text/annotation layers do not render in this Node pipeline at all (a separate, reproducible pdfjs-dist Node bug in its glyph-path cache) — irrelevant here since the actual Quran content is the raster image, not a text layer.

**None of this applies to the actual shipped viewer** (`PdfViewer.tsx`), which uses `react-pdf` — a browser-grade `pdfjs-dist` integration, unaffected by any of the above Node-specific bugs.

## 7. Runtime viewer (`PdfViewer.tsx`, `react-pdf`)

- `react-pdf`'s own transitive `pdfjs-dist` is used directly (`import { pdfjs } from "react-pdf"`) — a second, independently-versioned `pdfjs-dist` is never installed; the two must match exactly or the worker hard-fails.
- **Worker file, self-hosted:** this app's CSP has no `worker-src` (falls back to `script-src 'self'`), so a CDN-hosted worker (the setup shown in most `react-pdf` docs) would be blocked. `scripts/pdf/copy-pdf-worker.mjs` (run via `"postinstall"`) copies whatever `pdf.worker.min.mjs` this install's `pdfjs-dist` resolves to into `public/pdf-worker/` (gitignored — regenerated on every `npm install`, like `.next/`).
- **SSR:** `pdfjs-dist`'s browser build touches browser-only globals (`DOMMatrix`, etc.) at module scope, which crashes if evaluated during Next's server-side prerender of a "use client" component's initial HTML. `SurahReader.tsx` loads `PdfViewer` via `next/dynamic(..., { ssr: false })`, deferring its whole module graph to the browser only.
- Both `renderTextLayer`/`renderAnnotationLayer` are disabled on `<Page>` — these scans have no real text/annotations to layer, and skipping them avoids importing their CSS.

## 8. Scope decisions

- **No Juz-level PDF Mode; Juz Mode was removed entirely.** The whole Juz browsing feature (`/juz` list + `/juz/[juzNumber]` reader, text and PDF alike) was removed from the app to keep only Surah-level reading, and — since each Surah's own PDF already contains that Surah's full content — dropping ~48MB of committed whole-Juz PDFs (`public/pdf/juz/`) that existed only to serve a redundant Juz PDF Mode. The per-Juz watermark-stripped files still exist as a **build-time-only intermediate** (`.pdf-build/juz/`, gitignored, not served) — §2/§3 — because `generate-surah-pdfs.mjs` still needs full-Juz pages as its copy source for cropping per-Surah PDFs; only the never-served committed copy was removed.
- **`PageReader` (Mushaf-page view) has no PDF Mode.** A standard Mushaf "page" number has no reliable counterpart inside these specific scans (§1's pagination mismatch) — mapping that would mean extending §4's manual verification to ~604 page-level boundaries instead of ~114 Surah-level ones, for no extra feature value over what Surah PDF Mode already gives.
- **Continue Reading doesn't track position in PDF Mode yet.** `AyahList`'s `IntersectionObserver`-based tracking has no equivalent for a canvas-rendered PDF page. `PdfViewer`'s `onPageChange` prop is the hook point for a future follow-up; not wired to anything yet.
