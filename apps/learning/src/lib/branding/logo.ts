import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Shared source for every generated brand image (favicon/app-icon, Apple
 * touch icon, OG share image — see src/app/icon.tsx, apple-icon.tsx,
 * opengraph-image.tsx). Same canonical file and crop boxes as
 * apps/quran/src/lib/branding/logo.ts (same source artwork,
 * public/brand/logo.png, copied into this app since there's no shared
 * package to import it from across apps/ — see root package.json) — kept
 * in sync by hand if the logo is ever replaced, same as quran's own copy.
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
 * 1254x1254 source artwork — everything below this is the "IQRA SPACE"
 * wordmark + tagline, illegible at favicon sizes, so icon-only contexts
 * crop it out.
 */
export const LOGO_ICON_CROP = { left: 267, top: 60, width: 720, height: 600 };

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
