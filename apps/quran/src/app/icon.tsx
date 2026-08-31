import { LOGO_ICON_CROP } from "@/lib/branding/logo";
import { renderCroppedIcon } from "@/lib/branding/renderCroppedIcon";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// See lib/branding/logo.ts for the shared crop math and why a crop is
// needed at all (the source logo includes the "IQRA SPACE" wordmark,
// illegible at favicon sizes — this keeps just the icon mark).
export default function Icon() {
  return renderCroppedIcon(LOGO_ICON_CROP, size);
}
