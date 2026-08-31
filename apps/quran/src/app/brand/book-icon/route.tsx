import { LOGO_BOOK_CROP } from "@/lib/branding/logo";
import { renderCroppedIcon } from "@/lib/branding/renderCroppedIcon";

// The book element is naturally wide/short — the output frame matches
// its crop's own aspect ratio exactly (no letterboxing) rather than
// forcing it into a square. Satori (next/og's renderer) has a real bug
// where a big asymmetric letterbox breaks the vertical offset entirely
// (confirmed by testing: the crop rendered as the *whole* icon+wordmark,
// completely ignoring its own top/height — root-caused via a throwaway
// debug route before landing on this fix, not guessed). Matching the
// frame ratio sidesteps it regardless of how extreme the crop itself is.
const SIZE = { width: 400, height: Math.round((400 * LOGO_BOOK_CROP.height) / LOGO_BOOK_CROP.width) };

export const dynamic = "force-static";

export async function GET() {
  return renderCroppedIcon(LOGO_BOOK_CROP, SIZE, "transparent");
}
