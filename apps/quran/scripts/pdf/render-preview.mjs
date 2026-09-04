// One-off inspection helper (not part of the runtime app) used to visually
// verify Surah boundaries inside the scanned Juz PDFs for
// scripts/pdf/surah-page-map.json (see PDF-CONTENT.md). Renders a range of
// pages from one PDF into a single labeled contact-sheet PNG so a human
// (or an agent using the Read tool's image viewer) can review many pages
// per look, since this sandbox has no poppler/pdftoppm for the Read tool's
// own built-in PDF paging.
//
// Usage: node scripts/pdf/render-preview.mjs <pdfPath> <firstPage> <lastPage> <outPngPath> [cols]
//
// Uses node-canvas (`canvas`) with a drawImage bridge for pdfjs-dist's
// internal @napi-rs/canvas offscreen objects (a real Node-pipeline
// incompatibility between pdfjs-dist and node canvas libraries — see
// PDF-CONTENT.md for how this was diagnosed). Text layers do not render in
// this pipeline (a separate pdfjs-dist Node bug) but that only affects the
// PDF's own extractable text (the non-Quran watermark, already stripped) —
// the scanned Quran page image, including its printed margin annotations,
// is a raster image and renders correctly.

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import * as NodeCanvas from "canvas";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfjsPkgDir = path.dirname(
  fileURLToPath(new URL("../../node_modules/pdfjs-dist/package.json", `file://${__dirname}/`))
);
const standardFontDataUrl = pathToFileURL(path.join(pdfjsPkgDir, "standard_fonts") + path.sep).href;
const cMapUrl = pathToFileURL(path.join(pdfjsPkgDir, "cmaps") + path.sep).href;

class NodeCanvasFactory {
  create(width, height) {
    const canvas = NodeCanvas.createCanvas(width, height);
    const context = canvas.getContext("2d");
    const origDrawImage = context.drawImage.bind(context);
    // Bridge: pdfjs-dist's Node code hardcodes @napi-rs/canvas for its own
    // internal offscreen mask/fill canvases regardless of the factory we
    // supply here, so `drawImage` can receive a foreign canvas-like object.
    // Round-trip it through a PNG buffer into a real node-canvas Image.
    context.drawImage = (img, ...rest) => {
      if (
        img &&
        typeof img.toBuffer === "function" &&
        !(img instanceof NodeCanvas.Canvas) &&
        !(img instanceof NodeCanvas.Image)
      ) {
        const buf = img.toBuffer("image/png");
        const bridged = new NodeCanvas.Image();
        bridged.src = buf;
        return origDrawImage(bridged, ...rest);
      }
      return origDrawImage(img, ...rest);
    };
    // Some source pages set a clip path (PDF `re`/`W n`) before painting
    // the scanned image. node-canvas's clip() + pdfjs-dist's Path2D usage
    // don't interact correctly in this Node pipeline (same class of bug as
    // the font-glyph Path2D issue documented in PDF-CONTENT.md) and
    // silently produce a blank canvas instead of throwing. This is a
    // preview-only tool, not the shipped viewer (that's react-pdf, an
    // unrelated, browser-grade pdfjs integration), so just disable
    // clipping here rather than chase the Node-canvas bug — the clip
    // rectangles observed only trim page margins, never the content.
    context.clip = () => {};
    return { canvas, context };
  }
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

async function renderPageToCanvas(doc, pageNumber, scale) {
  const canvasFactory = new NodeCanvasFactory();
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);
  await page.render({ canvasContext: context, viewport, canvasFactory }).promise;
  return canvas;
}

async function main() {
  const [, , pdfPath, firstArg, lastArg, outPath, colsArg] = process.argv;
  const firstPage = parseInt(firstArg, 10);
  const lastPage = parseInt(lastArg, 10);
  const cols = colsArg ? parseInt(colsArg, 10) : 4;

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await getDocument({
    data,
    standardFontDataUrl,
    cMapUrl,
    cMapPacked: true,
    useSystemFonts: true,
  }).promise;

  const lastClamped = Math.min(lastPage, doc.numPages);
  const pageNums = [];
  for (let p = firstPage; p <= lastClamped; p++) pageNums.push(p);

  const scale = 1.0;
  const labelHeight = 22;
  const cellW = Math.round(540 * scale);
  const cellH = Math.round(756 * scale) + labelHeight;
  const rows = Math.ceil(pageNums.length / cols);

  const sheet = NodeCanvas.createCanvas(cellW * cols, cellH * rows);
  const sctx = sheet.getContext("2d");
  sctx.fillStyle = "#ffffff";
  sctx.fillRect(0, 0, sheet.width, sheet.height);

  for (let i = 0; i < pageNums.length; i++) {
    const pageNum = pageNums[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellW;
    const y = row * cellH;

    try {
      const pageCanvas = await renderPageToCanvas(doc, pageNum, scale);
      sctx.drawImage(pageCanvas, x, y + labelHeight);
    } catch (e) {
      sctx.fillStyle = "#ffdddd";
      sctx.fillRect(x, y + labelHeight, cellW, cellH - labelHeight);
      sctx.fillStyle = "#000000";
      sctx.fillText(`render failed: ${e.message}`, x + 4, y + labelHeight + 20);
    }

    sctx.strokeStyle = "#999999";
    sctx.strokeRect(x, y, cellW, cellH);
    sctx.fillStyle = "#000000";
    sctx.font = "bold 16px sans-serif";
    sctx.fillText(`page ${pageNum}`, x + 4, y + 16);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, sheet.toBuffer("image/png"));
  console.log(`wrote ${outPath} (${pageNums.length} pages, ${cols}x${rows} grid, doc has ${doc.numPages} pages total)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
