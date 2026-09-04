// Removes the non-Quran promotional watermark ("www.Islamicnet.com" /
// "Learn quran online with Tajweed from...") that the source PDFs carry,
// WITHOUT touching the scanned Quran page image or the main content
// stream in any way. See PDF-CONTENT.md for how this was verified.
//
// The watermark is added by Adobe Acrobat's batch "Add Header and Footer"
// feature: it is two Form XObjects, tagged
// /PieceInfo/ADBE_CompoundType/Private = /Header or /Footer, placed in the
// blank top/bottom margins, fully independent of the scanned page image
// (a separate /Im0 image XObject per page). Acrobat's batch feature emits
// ONE shared Header Form and ONE shared Footer Form object, referenced by
// every page's /Resources — not a fresh pair per page — so this script
// de-duplicates by the underlying object reference before checking/
// stripping, rather than processing per page (processing per page would
// "verify watermark present" against an object another page already
// emptied, and falsely skip it).
//
// Usage: node scripts/pdf/strip-watermark.mjs
// Reads apps/quran/pdf/Holy-Quran-Para-{1..30}.pdf (source, untouched)
// Writes apps/quran/.pdf-build/juz/para-{1..30}.pdf (watermark-free, but an
// intermediate build artifact only — see PDF-CONTENT.md. There is no
// Juz-level PDF Mode in the app (Juz Mode was removed); these per-Juz
// files exist solely as input to generate-surah-pdfs.mjs, which copies
// exact per-Surah page ranges out of them into public/pdf/surah/ — the
// only PDF output actually served. Gitignored, not committed: regenerate
// with `npm run pdf:strip-watermark` whenever the source PDFs change.

import { PDFDocument, PDFName, PDFRawStream, PDFRef } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..", "..");
const SRC_DIR = path.join(appRoot, "pdf");
const OUT_DIR = path.join(appRoot, ".pdf-build", "juz");

const JUZ_COUNT = 30;

/** Belt-and-suspenders guard: only remove a /Header or /Footer Form whose
 * decoded content actually contains the known watermark string — verified
 * present in every such Form found across all 30 source files, but this
 * guard means a legitimate header/footer (if one is ever added to a future
 * source file) is never silently eaten. */
const WATERMARK_NEEDLE = "islamicnet";

function decodeFormText(formStream) {
  try {
    const bytes = Buffer.from(formStream.contents);
    const filter = formStream.dict.lookup(PDFName.of("Filter"));
    const filterStr = filter ? filter.toString() : "";
    const decoded = filterStr.includes("FlateDecode") ? zlib.inflateSync(bytes) : bytes;
    return decoded.toString("latin1").toLowerCase();
  } catch {
    return "";
  }
}

/** Finds every /Header or /Footer Form XObject reachable from any page's
 * /Resources, de-duplicated by object reference (see header comment for
 * why de-duping matters here). Returns [{ ref, obj, pagesReferencing }]. */
function findWatermarkForms(pdfDoc) {
  const found = new Map(); // refString -> { ref, obj, pagesReferencing }

  for (const page of pdfDoc.getPages()) {
    const xobjDict = page.node.Resources()?.lookup(PDFName.of("XObject"));
    if (!xobjDict) continue;

    for (const key of xobjDict.keys()) {
      const ref = xobjDict.get(key);
      const refString = ref instanceof PDFRef ? ref.toString() : `inline:${key.toString()}`;
      if (found.has(refString)) {
        found.get(refString).pagesReferencing++;
        continue;
      }

      const obj = pdfDoc.context.lookup(ref);
      if (!(obj instanceof PDFRawStream)) continue;

      const subtype = obj.dict.lookup(PDFName.of("Subtype"));
      if (!subtype || subtype.toString() !== "/Form") continue;

      const pieceInfo = obj.dict.lookup(PDFName.of("PieceInfo"));
      const compound = pieceInfo?.lookup(PDFName.of("ADBE_CompoundType"));
      const priv = compound?.lookup(PDFName.of("Private"));
      const privStr = priv ? priv.toString() : null;
      if (privStr !== "/Header" && privStr !== "/Footer") continue;

      found.set(refString, { ref, obj, kind: privStr.slice(1), pagesReferencing: 1 });
    }
  }

  return [...found.values()];
}

function stripForm(pdfDoc, obj) {
  obj.dict.delete(PDFName.of("Filter"));
  obj.dict.delete(PDFName.of("DecodeParms"));
  obj.contents = new Uint8Array(0);
  obj.dict.set(PDFName.of("Length"), pdfDoc.context.obj(0));
}

async function processFile(juzNumber) {
  const srcPath = path.join(SRC_DIR, `Holy-Quran-Para-${juzNumber}.pdf`);
  const outPath = path.join(OUT_DIR, `para-${juzNumber}.pdf`);

  const srcBytes = fs.readFileSync(srcPath);
  const pdfDoc = await PDFDocument.load(srcBytes, { updateMetadata: false });

  const candidates = findWatermarkForms(pdfDoc);
  let stripped = 0;
  let pagesAffected = 0;
  for (const candidate of candidates) {
    if (!decodeFormText(candidate.obj).includes(WATERMARK_NEEDLE)) {
      console.warn(
        `  WARNING: a /${candidate.kind} form (referenced by ${candidate.pagesReferencing} page(s)) ` +
          `was found WITHOUT the expected watermark text — skipped, not removed.`
      );
      continue;
    }
    stripForm(pdfDoc, candidate.obj);
    stripped++;
    pagesAffected += candidate.pagesReferencing;
  }

  const outBytes = await pdfDoc.save();
  fs.writeFileSync(outPath, outBytes);

  return {
    pages: pdfDoc.getPageCount(),
    uniqueFormsFound: candidates.length,
    uniqueFormsStripped: stripped,
    pagesAffected,
    inBytes: srcBytes.length,
    outBytes: outBytes.length,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let totalPages = 0;
  let totalUniqueStripped = 0;
  let totalPagesAffected = 0;
  const t0 = Date.now();

  for (let juz = 1; juz <= JUZ_COUNT; juz++) {
    const result = await processFile(juz);
    totalPages += result.pages;
    totalUniqueStripped += result.uniqueFormsStripped;
    totalPagesAffected += result.pagesAffected;
    console.log(
      `Juz ${String(juz).padStart(2, "0")}: ${result.pages} pages, ` +
        `${result.uniqueFormsStripped}/${result.uniqueFormsFound} unique watermark form(s) stripped ` +
        `(covering ${result.pagesAffected} page-references) (${result.inBytes} -> ${result.outBytes} bytes)`
    );
    if (result.uniqueFormsFound !== 2 || result.uniqueFormsStripped !== 2) {
      console.warn(
        `  NOTE: expected exactly 2 unique watermark forms (1 Header + 1 Footer) in this file — ` +
          `found ${result.uniqueFormsFound}, stripped ${result.uniqueFormsStripped}. Investigate before trusting this file's output.`
      );
    }
  }

  console.log(
    `\nDone. ${JUZ_COUNT} files, ${totalPages} pages total, ${totalUniqueStripped} unique watermark forms stripped, ` +
      `${totalPagesAffected} total page-references covered, ${Date.now() - t0}ms.`
  );
}

main();
