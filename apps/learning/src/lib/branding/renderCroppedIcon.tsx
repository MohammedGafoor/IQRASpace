import { ImageResponse } from "next/og";
import { computeContainCrop, readLogoDataUri } from "./logo";

/**
 * Shared body for every generated brand image that's "a crop of the logo
 * fit into a square/rect frame" — icon.tsx, apple-icon.tsx, and
 * opengraph-image.tsx all just call this with a different crop box and
 * frame size. Same implementation as apps/quran's own copy.
 */
export function renderCroppedIcon(
  crop: { left: number; top: number; width: number; height: number },
  frame: { width: number; height: number },
  background: string | "transparent" = "white"
) {
  const { scaledSourceSize, offsetX, offsetY } = computeContainCrop(crop, frame);
  // Satori (next/og's renderer) defaults to an OPAQUE white canvas when no
  // background is set at all. The literal string "transparent" is also
  // not a recognized value — an explicit rgba() with zero alpha is what
  // actually produces alpha transparency.
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
