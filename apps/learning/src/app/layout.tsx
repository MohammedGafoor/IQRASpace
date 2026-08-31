import type { Metadata } from "next";
import { Fraunces, Inter, Amiri } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { canonicalUrl } from "@/lib/site";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const amiri = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  // Resolves relative OG/Twitter image URLs (opengraph-image.tsx) against
  // the real production origin instead of defaulting to localhost:3000 —
  // same fix apps/quran's own layout.tsx applied first.
  metadataBase: new URL(canonicalUrl("/")),
  title: "IQRASpace",
  description: "Online Quran learning management for a solo tutor and their students.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${amiri.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Blocking, pre-hydration theme apply — avoids a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
