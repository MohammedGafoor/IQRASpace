import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdjacentPage, getPageNumbers, getVersesForPage } from "@/lib/content/quran";
import { PageReader } from "@/components/reader/PageReader";
import { canonicalUrl } from "@/lib/site";

type Props = {
  params: Promise<{ pageNumber: string }>;
};

export function generateStaticParams() {
  return getPageNumbers().map((pageNumber) => ({ pageNumber: String(pageNumber) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pageNumber } = await params;
  return {
    title: `Page ${pageNumber} — IqraSpace Quran`,
    description: `Read Mushaf page ${pageNumber} of the Quran, with translation.`,
    alternates: { canonical: canonicalUrl(`/page/${pageNumber}`) },
  };
}

export default async function MushafPage({ params }: Props) {
  const { pageNumber } = await params;
  const number = Number(pageNumber);
  const verses = getVersesForPage(number);

  if (verses.length === 0) {
    notFound();
  }

  const { previous, next } = getAdjacentPage(number);

  return <PageReader pageNumber={number} verses={verses} previous={previous} next={next} />;
}
