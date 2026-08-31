import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Shared source for every generated brand image (favicon/app-icon, Apple
 * touch icon, OG share image, and the decorative book/candle icons used
 * on the homepage — see src/app/icon.tsx, apple-icon.tsx,
 * opengraph-image.tsx, and src/app/brand/*\/route.tsx). One canonical
 * file (public/brand/logo.png — also referenced directly by <img> where
 * the full logo is shown, e.g. the homepage hero) and one set of
 * hand-measured crop boxes, so nothing can drift out of sync with the
 * others if the logo file is ever replaced.
 */

export const LOGO_SOURCE_SIZE = 1254;

function readLogoBuffer() {
  const logoPath = path.join(process.cwd(), "public", "brand", "logo.png");
  return readFileSync(logoPath);
}

export function readLogoDataUri(): string {
  return `data:image/png;base64,${readLogoBuffer().toString("base64")}`;
}

/**
 * The full book+tower+star icon mark's bounding box within the
 * 1254x1254 source artwork, measured directly against the actual file
 * (not guessed) — everything below this is the "IQRA SPACE" wordmark +
 * tagline, illegible at favicon sizes, so icon-only contexts crop it out.
 */
export const LOGO_ICON_CROP = { left: 267, top: 60, width: 720, height: 600 };

/**
 * The two elements within the icon mark, cropped separately for use as
 * small decorative icons (e.g. the homepage's feature strip) — same
 * "measured against the real file, re-measure if it's ever replaced"
 * caveat as LOGO_ICON_CROP. The two boxes deliberately overlap a little
 * where the candle visually sits into the book in the source art, rather
 * than a razor-clean split.
 */
export const LOGO_CANDLE_CROP = { left: 495, top: 65, width: 270, height: 390 };
export const LOGO_BOOK_CROP = { left: 267, top: 445, width: 720, height: 145 };

/**
 * Computes the position/size for the FULL source image so that
 * `crop` (a region within it) fits a `frame` square via "contain"
 * semantics (uniform scale, letterboxed on the shorter axis) — the same
 * math CSS `object-fit: contain` would use, applied by hand since
 * next/og's renderer (Satori) doesn't support object-fit on `<img>`.
 */
export function computeContainCrop(
  crop: { left: number; top: number; width: number; height: number },
  frame: { width: number; height: number }
) {
  const scale = Math.min(frame.width / crop.width, frame.height / crop.height);
  const scaledSourceSize = LOGO_SOURCE_SIZE * scale;
  const horizontalPadding = (frame.width - crop.width * scale) / 2;
  const verticalPadding = (frame.height - crop.height * scale) / 2;
  return {
    scaledSourceSize,
    offsetX: horizontalPadding - crop.left * scale,
    offsetY: verticalPadding - crop.top * scale,
  };
}
