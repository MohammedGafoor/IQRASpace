/**
 * Content-attribution line (Readme.md §23/§28, QURAN-CONTENT.md §3) — kept
 * here rather than only on a dedicated attribution page, since that page
 * doesn't exist yet (Phase 9). Server component: no interactivity needed.
 */
export function SiteFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--color-border)",
        marginTop: "3rem",
        padding: "1.5rem 1rem",
        textAlign: "center",
        color: "var(--color-text-muted)",
        fontSize: "0.8rem",
      }}
    >
      <p style={{ margin: 0 }}>
        Quran text and translation data provided by the{" "}
        <a href="https://quran.foundation" style={{ color: "inherit" }}>
          Quran Foundation
        </a>
        . IqraSpace Quran is a free, ad-free reading platform — Sadaqah Jariyah, not a commercial product.
      </p>
    </footer>
  );
}
