import { LOGO_ICON_CROP } from "@/lib/branding/logo";
import { renderCroppedIcon } from "@/lib/branding/renderCroppedIcon";

// Apple's recommended touch-icon size. Same crop as icon.tsx (see
// lib/branding/logo.ts) — Apple ignores transparency/rounds corners
// itself, so a plain white background here is correct.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderCroppedIcon(LOGO_ICON_CROP, size);
}
