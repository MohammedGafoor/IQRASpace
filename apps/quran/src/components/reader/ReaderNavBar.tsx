import Link from "next/link";

type NavTarget = { href: string; label: string };

type Props = {
  previous: NavTarget | undefined;
  next: NavTarget | undefined;
  variant?: "top" | "bottom";
};

/**
 * Prev/next navigation, shared by Surah/Juz/Page readers (each just
 * supplies its own href/label pairs) — kept as one component so the
 * three readers can't drift into subtly different markup/behavior.
 *
 * Every reader renders this twice (top and bottom of the ayah list) —
 * only the top one is a `<nav>` landmark. Two identically-labeled
 * landmarks on one page is confusing for landmark-based screen-reader
 * navigation (found by an axe-core scan, not by inspection — see
 * PRODUCT-ROADMAP.md's Phase 1 status); the bottom copy is a plain
 * repeat for convenience, not a second landmark to jump to.
 */
export function ReaderNavBar({ previous, next, variant = "top" }: Props) {
  const Container = variant === "top" ? "nav" : "div";

  return (
    <Container
      {...(variant === "top" ? { "aria-label": "Surah/Juz/Page navigation" } : {})}
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: variant === "top" ? "1rem" : 0,
        marginTop: variant === "bottom" ? "2rem" : 0,
        paddingTop: variant === "bottom" ? "1rem" : 0,
        borderTop: variant === "bottom" ? "1px solid var(--color-border)" : "none",
      }}
    >
      {previous ? (
        <Link href={previous.href} style={{ color: "var(--color-primary)" }}>
          ← {previous.label}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href} style={{ color: "var(--color-primary)" }}>
          {next.label} →
        </Link>
      ) : (
        <span />
      )}
    </Container>
  );
}
