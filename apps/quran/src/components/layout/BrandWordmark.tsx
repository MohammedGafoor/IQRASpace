import type { CSSProperties } from "react";

type Props = {
  size?: "sm" | "lg";
  /** Shows "Quran" under/after the wordmark — this app is one product
      under the wider IqraSpace name (Readme.md §40's ecosystem), so the
      wordmark alone is the brand, not this specific product. */
  showProductLabel?: boolean;
};

/**
 * "IQRA" (teal) + "SPACE" (gold) in the display serif — matches the
 * IqraSpace logo's two-tone wordmark. Text, not an image: crisp at any
 * size/theme, no asset to ship, and matches exactly once real brand
 * colors were confirmed against the logo (globals.css's note on
 * --color-primary/--color-accent).
 */
export function BrandWordmark({ size = "sm", showProductLabel = true }: Props) {
  const fontSize = size === "lg" ? "clamp(1.75rem, 6vw, 2.5rem)" : "1.15rem";

  return (
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
  );
}

export const flourishRuleStyle: CSSProperties = {
  display: "inline-block",
  width: "2rem",
  height: "1px",
  background: "var(--color-accent)",
  verticalAlign: "middle",
};
