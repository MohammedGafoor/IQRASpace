import { LOGO_CANDLE_CROP } from "@/lib/branding/logo";
import { renderCroppedIcon } from "@/lib/branding/renderCroppedIcon";

// Same frame-matches-crop-ratio fix as book-icon's sibling route — see
// its comment for the full explanation of the Satori bug this avoids.
const SIZE = { width: Math.round((320 * LOGO_CANDLE_CROP.width) / LOGO_CANDLE_CROP.height), height: 320 };

export const dynamic = "force-static";

export async function GET() {
  return renderCroppedIcon(LOGO_CANDLE_CROP, SIZE, "transparent");
}
