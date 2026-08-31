import { ImageResponse } from "next/og";
import { computeContainCrop, readLogoDataUri } from "./logo";

/**
 * Shared body for every generated brand image that's "a crop of the logo
 * fit into a square/rect frame" — icon.tsx, apple-icon.tsx, and the
 * book/candle decorative icons under app/brand/*\/route.tsx all just call
 * this with a different crop box and frame size. Factored out once a
 * third and fourth near-identical instance showed up (Readme.md §41).
 */
export function renderCroppedIcon(
  crop: { left: number; top: number; width: number; height: number },
  frame: { width: number; height: number },
  background: string | "transparent" = "white"
) {
  const { scaledSourceSize, offsetX, offsetY } = computeContainCrop(crop, frame);
  // Satori (next/og's renderer) defaults to an OPAQUE white canvas when no
  // background is set at all — confirmed by testing (rendered an icon
  // over a red HTML background and got a solid white box, not red
  // bleeding through). The literal string "transparent" is also not a
  // recognized value. The one that actually produces alpha transparency
  // is an explicit rgba() with zero alpha.
  const containerStyle: Record<string, string | number> = {
    width: frame.width,
    height: frame.height,
    display: "flex",
    overflow: "hidden",
    position: "relative",
    background: background === "transparent" ? "rgba(0,0,0,0)" : background,
  };

  return new ImageResponse(
    (
      <div style={containerStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og's renderer requires a plain <img>, not next/image */}
        <img
          alt=""
          src={readLogoDataUri()}
          width={scaledSourceSize}
          height={scaledSourceSize}
          style={{ position: "absolute", left: offsetX, top: offsetY }}
        />
      </div>
    ),
    { ...frame }
  );
}
