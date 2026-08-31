#!/usr/bin/env node
// PdfViewer (src/components/pdf/PdfViewer.tsx) needs three asset directories
// from pdfjs-dist served over plain HTTP at runtime — the worker can't reach
// into node_modules itself:
//   - wasm/            JBIG2 / OpenJPEG / qcms decoders (v6 moved these off
//                       pure-JS; without `wasmUrl` pdf.js silently drops any
//                       image XObject it can't decode — e.g. a scanned Quran
//                       page comes back a blank page with just the vector
//                       header/footer text, no pagination error at all).
//   - standard_fonts/  fallback glyphs for PDFs that reference a standard
//                       font (Helvetica, etc.) without embedding it.
//   - cmaps/           predefined Adobe CMaps for embedded CID/Type0 fonts
//                       (common in Arabic/CJK text PDFs).
// `new URL("pdfjs-dist/...", import.meta.url)` (as used for the worker
// script) only bundles a single referenced file, not a whole directory of
// files pdf.js requests dynamically by name — so instead we copy these
// directories into public/pdfjs/ and point pdf.js at that plain URL.
//
// Runs via the predev/prebuild npm scripts (see package.json) so it always
// reflects the installed pdfjs-dist version; public/pdfjs/ itself is
// git-ignored, not a committed asset.
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const pdfjsRoot = join(webRoot, "node_modules", "pdfjs-dist");
const destRoot = join(webRoot, "public", "pdfjs");
const versionStampPath = join(destRoot, ".pdfjs-dist-version");

const pdfjsVersion = JSON.parse(readFileSync(join(pdfjsRoot, "package.json"), "utf8")).version;
const stamped = existsSync(versionStampPath) ? readFileSync(versionStampPath, "utf8").trim() : null;

if (stamped === pdfjsVersion) {
  process.exit(0);
}

for (const dir of ["wasm", "standard_fonts", "cmaps"]) {
  const src = join(pdfjsRoot, dir);
  if (!existsSync(src)) {
    console.warn(`copy-pdfjs-assets: node_modules/pdfjs-dist/${dir} not found, skipping`);
    continue;
  }
  cpSync(src, join(destRoot, dir), { recursive: true });
}

mkdirSync(destRoot, { recursive: true });
writeFileSync(versionStampPath, pdfjsVersion);
console.log(`copy-pdfjs-assets: synced public/pdfjs/ for pdfjs-dist@${pdfjsVersion}`);
