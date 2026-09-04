import Link from "next/link";
import { BrandWordmark } from "@/components/layout/BrandWordmark";

/**
 * Handles both an unmatched route AND every notFound() call already
 * wired up in the dynamic Surah/Mushaf-page routes (an out-of-range
 * number falls through to this same file) — see PROJECT-STATUS.md's
 * production-readiness notes: that logic already existed and worked,
 * this just replaces Next's generic default page with a branded one.
 */
export default function NotFound() {
  return (
    <div style={{ maxWidth: "32rem", margin: "0 auto", padding: "4rem 1rem", textAlign: "center" }}>
      <BrandWordmark size="lg" />
      <h1 style={{ marginTop: "2rem", marginBottom: "0.5rem" }}>Page not found</h1>
      <p style={{ color: "var(--color-text-muted)" }}>
        That page doesn&apos;t exist — it may be an invalid Surah or Mushaf page number, or a broken link.
      </p>
      <p style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "1.5rem" }}>
        <Link href="/">Go home</Link>
        <Link href="/surah">Browse Surahs</Link>
      </p>
    </div>
  );
}
