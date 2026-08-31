import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdjacentJuz, getJuzNumbers, getVersesForJuz } from "@/lib/content/quran";
import { JuzReader } from "@/components/reader/JuzReader";
import { canonicalUrl } from "@/lib/site";

type Props = {
  params: Promise<{ juzNumber: string }>;
};

export function generateStaticParams() {
  return getJuzNumbers().map((juzNumber) => ({ juzNumber: String(juzNumber) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { juzNumber } = await params;
  return {
    title: `Juz ${juzNumber} — IqraSpace Quran`,
    description: `Read Juz ${juzNumber} of the Quran, with translation.`,
    alternates: { canonical: canonicalUrl(`/juz/${juzNumber}`) },
  };
}

export default async function JuzPage({ params }: Props) {
  const { juzNumber } = await params;
  const number = Number(juzNumber);
  const verses = getVersesForJuz(number);

  if (verses.length === 0) {
    notFound();
  }

  const { previous, next } = getAdjacentJuz(number);

  return <JuzReader juzNumber={number} verses={verses} previous={previous} next={next} />;
}
