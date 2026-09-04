// Copies the pdf.js worker script that this install's `react-pdf` actually
// resolves to into public/pdf-worker/, so PdfViewer can self-host it (this
// app's CSP has no worker-src, so it falls back to script-src 'self' — a
// CDN-hosted worker would be blocked; see PDF-CONTENT.md).
//
// Runs as "postinstall" so the copied file always matches whatever
// pdfjs-dist version npm actually resolved for react-pdf's dependency on
// this install — no manual version bookkeeping. Safe to run before
// react-pdf/pdfjs-dist are installed (e.g. very first `npm install`
// before this script's own package.json entry exists yet): it just skips.

import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..", "..");

function resolveWorkerSrc() {
  try {
    const pdfjsPkgPath = require.resolve("pdfjs-dist/package.json");
    const pdfjsDir = path.dirname(pdfjsPkgPath);
    const candidates = [
      path.join(pdfjsDir, "build", "pdf.worker.min.mjs"),
      path.join(pdfjsDir, "build", "pdf.worker.mjs"),
      path.join(pdfjsDir, "build", "pdf.worker.min.js"),
    ];
    return candidates.find((p) => existsSync(p));
  } catch {
    return undefined;
  }
}

const src = resolveWorkerSrc();
if (!src) {
  console.warn(
    "[copy-pdf-worker] pdfjs-dist not resolved yet (react-pdf not installed?) — skipping. " +
      "Re-run `npm install` once react-pdf is added to package.json."
  );
  process.exit(0);
}

const outDir = path.join(appRoot, "public", "pdf-worker");
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, path.basename(src));
copyFileSync(src, outPath);
console.log(`[copy-pdf-worker] copied ${path.relative(appRoot, src)} -> ${path.relative(appRoot, outPath)}`);
