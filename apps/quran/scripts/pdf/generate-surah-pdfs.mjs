// Generates one standalone PDF per Surah (114 files) by copying pages
// directly out of the watermark-stripped, per-Juz intermediate PDFs — a
// true PDF-object page copy via pdf-lib (`copyPages`/`addPage`), never a
// re-render/rasterize/OCR, so the original scan is preserved exactly. A
// Surah spanning multiple Juz files gets its pages copied from each
// source in order. This is the ONLY PDF content actually served by the
// app — there is no Juz-level PDF Mode (Juz Mode was removed); run
// `npm run pdf:strip-watermark` first if .pdf-build/juz/ doesn't exist yet.
//
// A Surah boundary very often falls MID-PAGE (the incoming Surah's own
// ornamental heading box commonly shares a physical scanned page with the
// outgoing Surah's last few ayahs — PDF-CONTENT.md §4a) — copying the
// whole shared page into both Surahs' PDFs would show each Surah content
// that isn't its own. surah-boundary-crops.json is a hand-verified list of
// exactly where each such shared page splits; this script crops that page
// (via pdf-lib's embedPage boundingBox — a real crop, not a re-render) on
// each side to its own Surah's content only, before copying — and, since
// the crop line sits right where the OTHER Surah's content begins with no
// real blank pixels to spare, pads the cropped side with genuine (drawn,
// not scanned) blank margin so it reads as a finished page ending rather
// than pixels cut off mid-line (CROP_BREATHING_ROOM_PT's own comment).
//
// A Surah that only barely spills onto a second scanned page (its own
// crop leaves very little content on one side) is merged back onto ONE
// output page instead — see MERGE_SAFETY_MARGIN_PT's comment below (§4b
// in PDF-CONTENT.md) for exactly when and how.
//
// Input:  scripts/pdf/surah-page-map.json (hand-verified, see PDF-CONTENT.md)
//         scripts/pdf/surah-boundary-crops.json (hand-verified split points)
//         .pdf-build/juz/para-{1..30}.pdf (watermark-stripped, gitignored
//         intermediate — produced by strip-watermark.mjs, not served)
// Output: public/pdf/surah/{surahId}.pdf (served)
//         src/content/generated/pdf-manifest.json (page counts + paths)
//
// Usage: node scripts/pdf/generate-surah-pdfs.mjs

import { PDFDocument } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..", "..");
const MAP_PATH = path.join(__dirname, "surah-page-map.json");
const CROPS_PATH = path.join(__dirname, "surah-boundary-crops.json");
const JUZ_DIR = path.join(appRoot, ".pdf-build", "juz");
const SURAH_OUT_DIR = path.join(appRoot, "public", "pdf", "surah");
const MANIFEST_PATH = path.join(appRoot, "src", "content", "generated", "pdf-manifest.json");

// The scanned pages' own ornamental frame — measured directly (not
// assumed) by rendering sample pages from 4 different Juz files and
// scanning for the frame's solid border rule (see PDF-CONTENT.md §4b):
// consistently ~74-79pt from the top and ~677-679pt from the top across
// all of them, i.e. a fixed print-template constant, not a per-page
// variable. This is "how much of a page a Surah with NO boundary crop on
// a given side naturally uses" — the reference budget §4b's merge
// decision compares against.
const FRAME_TOP_DFT = 76;
const FRAME_BOTTOM_DFT = 678;
const PAGE_CONTENT_BUDGET_PT = FRAME_BOTTOM_DFT - FRAME_TOP_DFT;

// Required slack below the budget before two pages are actually merged —
// protects against exactly the case that caught this during development:
// a Surah (Al-Balad, 90) whose combined content measured 602.6pt against
// a 602pt budget under real pixel measurement — 0.6pt over, invisible in
// the nominal-margin arithmetic that said "fits exactly". A real margin
// requirement makes that kind of near-miss fail closed (stays 2 pages)
// instead of silently producing a page whose content very slightly
// overflows its own drawn region.
const MERGE_SAFETY_MARGIN_PT = 5;

// A small gap between the two merged regions — they're two photographed
// halves of continuous running text (mid-ayah, not a Surah boundary), so
// no divider is drawn, just enough breathing room that the seam doesn't
// read as content jammed together. Roughly a typical inter-line gap on
// these scans (a few pt), chosen for visual comfort, not measured.
const MERGE_GAP_PT = 6;

// A boundary crop's own split point sits in the ONLY blank pixels
// available on that shared page (surah-boundary-crops.json's whole point
// is finding that exact gap) — there are no further blank scanned pixels
// to extend into without entering the other Surah's own content. Real
// pages end with generous margin before the ornamental frame closes them
// (PDF-CONTENT.md §4b); a boundary-cropped page had none of that, so its
// text sat flush against the reader's own page-frame chrome — reading as
// a screenshot cut off mid-line rather than a finished page. This margin
// is genuinely blank canvas added below/above the crop line (drawn as
// nothing — just unused page area — never scanned pixels stretched or
// invented), moderate enough to read as intentional whitespace without
// pretending to be the scan's own decorative border.
const CROP_BREATHING_ROOM_PT = 24;

const juzDocCache = new Map();

async function loadJuzDoc(juzNumber) {
  if (juzDocCache.has(juzNumber)) return juzDocCache.get(juzNumber);
  const filePath = path.join(JUZ_DIR, `para-${juzNumber}.pdf`);
  const bytes = fs.readFileSync(filePath);
  const doc = await PDFDocument.load(bytes);
  juzDocCache.set(juzNumber, doc);
  return doc;
}

// Crops a source page to the DFT (distance-from-top-of-page) region that
// belongs to THIS Surah, and pads whichever side(s) were actually cropped
// with CROP_BREATHING_ROOM_PT of genuine blank space — never the raw
// setCropBox alone (see CROP_BREATHING_ROOM_PT's own comment for why that
// reads as a mid-line cut, not a finished page).
//
// topDFT/bottomDFT (each optional — omit whichever side ISN'T a boundary
// crop, i.e. is this page's own natural page edge, which needs no
// padding of its own) bound the region to KEEP. A page normally needs
// only one side cropped, but several very short late-Juz-30 Surahs fit
// entirely on a single page sandwiched between the Surahs before and
// after them (surah-boundary-crops.json's "111->112" example) — passing
// BOTH bounds at once here (rather than two separate calls that would
// only ever produce two independent pages, unable to represent "one page
// cropped on both sides") is what makes that case work correctly.
async function buildCroppedPage(out, srcPage, { topDFT, bottomDFT } = {}) {
  const { width, height: pageHeightPts } = srcPage.getMediaBox();
  const top = topDFT ?? 0;
  const bottom = bottomDFT ?? pageHeightPts;
  const marginTop = topDFT != null ? CROP_BREATHING_ROOM_PT : 0;
  const marginBottom = bottomDFT != null ? CROP_BREATHING_ROOM_PT : 0;

  const embedded = await out.embedPage(srcPage, {
    left: 0,
    right: width,
    bottom: pageHeightPts - bottom,
    top: pageHeightPts - top,
  });

  const newPage = out.addPage([width, bottom - top + marginTop + marginBottom]);
  newPage.drawPage(embedded, { x: 0, y: marginBottom });
  return newPage;
}

// Decides whether a Surah spanning exactly 2 physical scanned pages
// should instead be presented as ONE merged page (PDF-CONTENT.md §4b) —
// and if so, the two DFT (distance-from-top-of-page) regions to keep
// from each source page. Only ever called for a single range covering
// exactly 2 consecutive pages; a Surah spanning 3+ pages is out of scope
// (per the requirement this implements) regardless of how short it is.
//
// region1 is page1's own boundary-crop split (if this Surah's start is a
// shared incoming boundary) down to the frame's natural bottom — page1
// always continues onto page2, so by definition it uses its full
// available height on that side, cropped or not. region2 mirrors that:
// the frame's natural top down to page2's own outgoing boundary-crop
// split (if this Surah's end is a shared outgoing boundary), or the
// frame's natural bottom if not.
function decideTwoPageMerge(range, incomingCrop, outgoingCrop, pageHeightPts) {
  if (range.endPage - range.startPage !== 1) return null; // only the literal "2 pages" case

  const region1 = { topDFT: incomingCrop?.splitPt ?? FRAME_TOP_DFT, bottomDFT: FRAME_BOTTOM_DFT };
  const region2 = { topDFT: FRAME_TOP_DFT, bottomDFT: outgoingCrop?.splitPt ?? FRAME_BOTTOM_DFT };
  const height1 = region1.bottomDFT - region1.topDFT;
  const height2 = region2.bottomDFT - region2.topDFT;
  const combined = height1 + height2;

  if (combined > PAGE_CONTENT_BUDGET_PT - MERGE_SAFETY_MARGIN_PT) return null;
  // Whichever outer edges of the merged page are themselves a boundary
  // crop (region1's top, region2's bottom — every merge candidate so far
  // happens to have both, being short Surahs sandwiched between others)
  // need the same CROP_BREATHING_ROOM_PT padding as any other
  // boundary-cropped page, for the same reason (buildCroppedPage's own
  // comment) — merging two pages into one doesn't change that the crop
  // line still sits flush against the adjacent Surah's content.
  return {
    region1,
    region2,
    height1,
    height2,
    pageHeightPts,
    marginTop: incomingCrop ? CROP_BREATHING_ROOM_PT : 0,
    marginBottom: outgoingCrop ? CROP_BREATHING_ROOM_PT : 0,
  };
}

// Builds the merged single page: embeds each source page cropped to its
// own DFT region (pdf-lib's embedPage boundingBox — a real crop, not a
// re-render) and draws them stacked at 1:1 scale on a new page sized to
// fit both exactly (plus any outer breathing-room margins). Returns that
// new page (not yet added to `out`) plus its height, so the caller can
// add it and record it like any other page.
async function buildMergedPage(out, srcPage1, srcPage2, decision) {
  const { region1, region2, height1, height2, pageHeightPts, marginTop, marginBottom } = decision;
  const { width } = srcPage1.getMediaBox();

  const toBoundingBox = (region) => ({
    left: 0,
    right: width,
    bottom: pageHeightPts - region.bottomDFT,
    top: pageHeightPts - region.topDFT,
  });

  const [embedded1, embedded2] = await out.embedPages(
    [srcPage1, srcPage2],
    [toBoundingBox(region1), toBoundingBox(region2)]
  );

  const mergedHeight = marginTop + height1 + MERGE_GAP_PT + height2 + marginBottom;
  const page = out.addPage([width, mergedHeight]);
  page.drawPage(embedded1, { x: 0, y: marginBottom + height2 + MERGE_GAP_PT });
  page.drawPage(embedded2, { x: 0, y: marginBottom });
  return page;
}

async function buildSurahPdf(surahId, ranges, boundaryCrops) {
  const out = await PDFDocument.create();

  const incomingCrop = boundaryCrops[`${surahId - 1}->${surahId}`];
  const outgoingCrop = boundaryCrops[`${surahId}->${surahId + 1}`];

  // The 2-pages-that-could-be-1 merge (PDF-CONTENT.md §4b) only ever
  // applies to a Surah that is a single source-page range spanning
  // exactly 2 pages — checked and handled entirely separately from the
  // general N-pages/N-ranges copy path below, since it produces one new
  // composed page rather than a straight page copy.
  if (ranges.length === 1 && ranges[0].endPage - ranges[0].startPage === 1) {
    const range = ranges[0];
    const src = await loadJuzDoc(range.juz);
    const pageCount = src.getPageCount();
    if (range.startPage < 1 || range.endPage > pageCount) {
      throw new Error(`Surah ${surahId}, juz ${range.juz}: invalid range ${range.startPage}-${range.endPage} (file has ${pageCount} pages)`);
    }
    if (incomingCrop && (range.juz !== incomingCrop.juz || range.startPage !== incomingCrop.page)) {
      throw new Error(
        `Surah ${surahId}: boundary crop '${surahId - 1}->${surahId}' expects juz ${incomingCrop.juz} p${incomingCrop.page} ` +
          `but this Surah's actual first page is juz ${range.juz} p${range.startPage} — surah-page-map.json and ` +
          `surah-boundary-crops.json have drifted apart; re-verify and update the crop entry.`
      );
    }
    if (outgoingCrop && (range.juz !== outgoingCrop.juz || range.endPage !== outgoingCrop.page)) {
      throw new Error(
        `Surah ${surahId}: boundary crop '${surahId}->${surahId + 1}' expects juz ${outgoingCrop.juz} p${outgoingCrop.page} ` +
          `but this Surah's actual last page is juz ${range.juz} p${range.endPage} — surah-page-map.json and ` +
          `surah-boundary-crops.json have drifted apart; re-verify and update the crop entry.`
      );
    }

    const srcPage1 = src.getPage(range.startPage - 1);
    const srcPage2 = src.getPage(range.endPage - 1);
    const { height: pageHeightPts } = srcPage1.getMediaBox();
    const decision = decideTwoPageMerge(range, incomingCrop, outgoingCrop, pageHeightPts);
    if (decision) {
      await buildMergedPage(out, srcPage1, srcPage2, decision);
      const bytes = await out.save();
      const outPath = path.join(SURAH_OUT_DIR, `${surahId}.pdf`);
      fs.writeFileSync(outPath, bytes);
      return { pageCount: out.getPageCount(), bytes: bytes.length, merged: true };
    }
    // Didn't qualify for merging (or no crop data at all to base a
    // confident decision on) — falls through to the general path below,
    // which will copy+crop these same 2 pages as normal.
  }

  // At most 2 physical pages in the whole Surah are ever a boundary crop:
  // its overall first page (if incomingCrop) and its overall last page
  // (if outgoingCrop) — a single-page Surah sandwiched between two others
  // (several very short late-Juz-30 Surahs are — see
  // surah-boundary-crops.json's "111->112" example) has BOTH land on the
  // very same page, which is exactly why buildCroppedPage takes both
  // bounds together rather than being called twice (see its own comment).
  // Validated up front against the actual page-map ranges, before any
  // copying, so a drift between the two data files is caught regardless
  // of which page(s) turn out to need cropping.
  const overallFirst = { juz: ranges[0].juz, page: ranges[0].startPage };
  const overallLast = { juz: ranges[ranges.length - 1].juz, page: ranges[ranges.length - 1].endPage };
  if (incomingCrop && (overallFirst.juz !== incomingCrop.juz || overallFirst.page !== incomingCrop.page)) {
    throw new Error(
      `Surah ${surahId}: boundary crop '${surahId - 1}->${surahId}' expects juz ${incomingCrop.juz} p${incomingCrop.page} ` +
        `but this Surah's actual first page is juz ${overallFirst.juz} p${overallFirst.page} — surah-page-map.json and ` +
        `surah-boundary-crops.json have drifted apart; re-verify and update the crop entry.`
    );
  }
  if (outgoingCrop && (overallLast.juz !== outgoingCrop.juz || overallLast.page !== outgoingCrop.page)) {
    throw new Error(
      `Surah ${surahId}: boundary crop '${surahId}->${surahId + 1}' expects juz ${outgoingCrop.juz} p${outgoingCrop.page} ` +
        `but this Surah's actual last page is juz ${overallLast.juz} p${overallLast.page} — surah-page-map.json and ` +
        `surah-boundary-crops.json have drifted apart; re-verify and update the crop entry.`
    );
  }

  for (const range of ranges) {
    const src = await loadJuzDoc(range.juz);
    const pageCount = src.getPageCount();
    if (range.startPage < 1 || range.endPage > pageCount || range.startPage > range.endPage) {
      throw new Error(
        `Surah ${surahId}, juz ${range.juz}: invalid range ${range.startPage}-${range.endPage} (file has ${pageCount} pages)`
      );
    }

    for (let p = range.startPage; p <= range.endPage; p++) {
      const needsIncoming = incomingCrop && range === ranges[0] && p === range.startPage;
      const needsOutgoing = outgoingCrop && range === ranges[ranges.length - 1] && p === range.endPage;
      if (needsIncoming || needsOutgoing) {
        await buildCroppedPage(out, src.getPage(p - 1), {
          topDFT: needsIncoming ? incomingCrop.splitPt : undefined,
          bottomDFT: needsOutgoing ? outgoingCrop.splitPt : undefined,
        });
      } else {
        const [copied] = await out.copyPages(src, [p - 1]);
        out.addPage(copied);
      }
    }
  }

  const bytes = await out.save();
  const outPath = path.join(SURAH_OUT_DIR, `${surahId}.pdf`);
  fs.writeFileSync(outPath, bytes);
  return { pageCount: out.getPageCount(), bytes: bytes.length };
}

async function main() {
  const map = JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));
  const boundaryCrops = JSON.parse(fs.readFileSync(CROPS_PATH, "utf8")).splits;
  fs.mkdirSync(SURAH_OUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });

  const manifestSurahs = {};
  const skipped = [];
  const merged = [];
  const t0 = Date.now();

  for (let id = 1; id <= 114; id++) {
    const entry = map.surahs[String(id)];
    if (!entry || !entry.ranges || entry.ranges.length === 0) {
      skipped.push(id);
      console.warn(`Surah ${id}: SKIPPED — no entry in surah-page-map.json`);
      continue;
    }

    const { pageCount, bytes, merged: wasMerged } = await buildSurahPdf(id, entry.ranges, boundaryCrops);
    manifestSurahs[String(id)] = { file: `surah/${id}.pdf`, pageCount };
    if (wasMerged) merged.push(id);
    console.log(
      `Surah ${String(id).padStart(3)}: ${pageCount} pages, ${bytes} bytes (${entry.ranges.length} source range(s))` +
        (wasMerged ? " [merged onto 1 page]" : "")
    );
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    surahs: manifestSurahs,
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log(
    `\nDone. ${Object.keys(manifestSurahs).length}/114 Surah PDFs generated, ${skipped.length} skipped, ` +
      `${merged.length} merged onto 1 page, ${Date.now() - t0}ms.`
  );
  if (skipped.length > 0) {
    console.warn(`Skipped Surahs (no map entry): ${skipped.join(", ")}`);
  }
  if (merged.length > 0) {
    console.log(`Merged (2 scanned pages -> 1 output page): ${merged.join(", ")}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
