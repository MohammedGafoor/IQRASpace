import Image from "next/image";
import { getAllChapters } from "@/lib/content/quran";
import { ContinueReadingCard } from "@/components/home/ContinueReadingCard";

/**
 * Home page. Reading requires no account (Readme.md §9) — the primary
 * action is always reachable in one click, whether that's "start reading"
 * (first visit) or "continue reading" (returning visitor, tracked
 * locally — see ContinueReadingCard).
 *
 * The full logo (public/brand/logo.png) already bakes in the "IQRA
 * SPACE" wordmark and the "Read. Listen. Learn. Reflect." tagline — so
 * showing it prominently here replaces the separate text wordmark this
 * page used to render below it (that would just be repeating the same
 * words as plain text right under an image already saying them). Per the
 * user's own reference screenshot: no Bismillah line and no feature-card
 * section here — kept deliberately minimal.
 */
export default function Home() {
  const chapters = getAllChapters();

  return (
    <div
      style={{
        minHeight: "70dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        padding: "2.5rem 1rem",
        textAlign: "center",
      }}
    >
      <Image
        src="/brand/logo.png"
        alt="IqraSpace Quran — Read. Listen. Learn. Reflect."
        width={1254}
        height={1254}
        priority
        style={{ width: "min(260px, 55vw)", height: "auto" }}
      />

      <p style={{ color: "var(--color-text-muted)", maxWidth: "32rem", margin: 0 }}>
        Free, fast, and accessible to everyone, everywhere.
      </p>

      <ContinueReadingCard chapters={chapters} />
    </div>
  );
}
