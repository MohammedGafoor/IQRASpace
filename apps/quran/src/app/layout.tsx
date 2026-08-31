import type { Metadata, Viewport } from "next";
import { Amiri, Amiri_Quran, Fraunces, Inter, Lateef, Noto_Naskh_Arabic, Scheherazade_New } from "next/font/google";
import { ReaderPreferencesProvider } from "@/lib/preferences/ReaderPreferencesProvider";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { canonicalUrl } from "@/lib/site";
import "./globals.css";

// Amiri: the standard open-source Arabic typeface for Quranic-script UI
// (used elsewhere in this repo too — see apps/web/src/app/globals.css).
// Scheherazade New/Lateef/Noto Naskh Arabic: three further open Naskh
// faces offered in Settings' Arabic font picker (lib/content/arabicFonts.ts)
// alongside Amiri — all sustained-reading Quran faces, not display fonts.
// Inter: a calm, legible Latin body face for UI chrome.
// Fraunces: warm display serif matching the IqraSpace wordmark/logo's
// lettering (see components/layout/SiteHeader.tsx) — used only for the
// brand name and headings, never body text or Quran content.
const amiri = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic"],
  weight: ["400", "700"],
  display: "swap",
});

const amiriQuran = Amiri_Quran({
  variable: "--font-amiri-quran",
  subsets: ["arabic"],
  weight: ["400"],
  display: "swap",
});

const scheherazade = Scheherazade_New({
  variable: "--font-scheherazade",
  subsets: ["arabic"],
  weight: ["400", "700"],
  display: "swap",
});

const lateef = Lateef({
  variable: "--font-lateef",
  subsets: ["arabic"],
  weight: ["400", "700"],
  display: "swap",
});

const notoNaskh = Noto_Naskh_Arabic({
  variable: "--font-noto-naskh",
  subsets: ["arabic"],
  weight: ["400", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  // Resolves relative OG/Twitter image URLs (opengraph-image.tsx) against
  // the real production origin instead of defaulting to localhost:3000 —
  // see PROJECT-STATUS.md's production-readiness inspection notes.
  metadataBase: new URL(canonicalUrl("/")),
  title: "IqraSpace Quran",
  description:
    "Read. Listen. Learn. Reflect. A free, fast, and accessible way to read the Quran on any device.",
  alternates: { canonical: canonicalUrl("/") },
  // No `manifest:` field here — src/app/manifest.ts (a Next.js metadata
  // route) makes Next auto-emit the <link rel="manifest"> tag with the
  // correct basePath-prefixed href itself; a hardcoded "/manifest.webmanifest"
  // string here would NOT get that prefix and would 404 in production.
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f0" },
    { media: "(prefers-color-scheme: dark)", color: "#101512" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr">
      <body
        className={`${amiri.variable} ${amiriQuran.variable} ${scheherazade.variable} ${lateef.variable} ${notoNaskh.variable} ${inter.variable} ${fraunces.variable}`}
      >
        <ReaderPreferencesProvider>
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <SiteHeader />
          <main id="main-content">{children}</main>
          <SiteFooter />
        </ReaderPreferencesProvider>
      </body>
    </html>
  );
}
