import { LOGO_SOURCE_SIZE } from "@/lib/branding/logo";
import { renderCroppedIcon } from "@/lib/branding/renderCroppedIcon";

// Standard OG/social-share image size. Uses the FULL logo lockup (mark +
// wordmark + tagline) — unlike icon.tsx/apple-icon.tsx, there's no
// legibility problem at this size, so the "crop" is just the whole image.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Matches globals.css's --color-bg (light theme) — OG images are static
// files with no access to CSS custom properties, so this is duplicated
// deliberately rather than shared as a token.
const IVORY_BACKGROUND = "#faf7f0";

export default function OpengraphImage() {
  const fullImageCrop = { left: 0, top: 0, width: LOGO_SOURCE_SIZE, height: LOGO_SOURCE_SIZE };
  return renderCroppedIcon(fullImageCrop, size, IVORY_BACKGROUND);
}
