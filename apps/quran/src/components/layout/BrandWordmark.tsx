import Image from "next/image";
import type { CSSProperties } from "react";

type Props = {
  size?: "sm" | "lg";
  /** Shows "Quran" under/after the wordmark — this app is one product
      under the wider IqraSpace name (Readme.md §40's ecosystem), so the
      wordmark alone is the brand, not this specific product. */
  showProductLabel?: boolean;
};

/**
 * The icon mark (from app/icon.tsx — the same generated crop of
 * public/brand/logo.png used for the favicon/app icon, see
 * lib/branding/logo.ts) + "IQRA" (teal) + "SPACE" (gold) in the display
 * serif, matching the IqraSpace logo's two-tone wordmark.
 *
 * Used to be text only — crisp at any size/theme, no asset to ship — but
 * that left the one persistent, most-seen brand touchpoint (SiteHeader,
 * on every page) as the only place in the app NOT showing the actual
 * book/candle/star mark once the favicon/homepage hero/OG image all
 * picked it up, which reads as stale by comparison. Pulling from
 * app/icon.tsx rather than a separate copy means this can never drift
 * from the approved crop if the logo is ever replaced.
 */
export function BrandWordmark({ size = "sm", showProductLabel = true }: Props) {
  const fontSize = size === "lg" ? "clamp(1.75rem, 6vw, 2.5rem)" : "1.15rem";
  const iconSize = size === "lg" ? 40 : 28;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
      {/* next/image (not a plain <img>) so basePath is applied
          automatically in both server (not-found.tsx) and client
          (SiteHeader) contexts — see app/icon.tsx's own size export for
          the 512x512 source this is scaled down from. */}
      <Image src="/icon" alt="" width={512} height={512} priority style={{ width: iconSize, height: iconSize, flexShrink: 0 }} />
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: "0.4rem", flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize,
            letterSpacing: "0.04em",
            lineHeight: 1,
          }}
        >
          <span style={{ color: "var(--color-primary)" }}>IQRA</span>
          <span style={{ color: "var(--color-accent-text)" }}>SPACE</span>
        </span>
        {showProductLabel && (
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: size === "lg" ? "1rem" : "0.7rem",
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Quran
          </span>
        )}
      </span>
    </span>
  );
}

export const flourishRuleStyle: CSSProperties = {
  display: "inline-block",
  width: "2rem",
  height: "1px",
  background: "var(--color-accent)",
  verticalAlign: "middle",
};
