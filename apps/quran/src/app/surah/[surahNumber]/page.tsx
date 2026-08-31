import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdjacentSurahs, getAllChapters, getSurahContent } from "@/lib/content/quran";
import { SurahReader } from "@/components/reader/SurahReader";
import { canonicalUrl } from "@/lib/site";

type Props = {
  params: Promise<{ surahNumber: string }>;
};

// SSG for every Surah actually synced (Readme.md §19/§22 — first Quran
// content should appear extremely quickly, so this is prerendered, not
// rendered on demand).
export function generateStaticParams() {
  return getAllChapters().map((chapter) => ({ surahNumber: String(chapter.id) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { surahNumber } = await params;
  const content = getSurahContent(Number(surahNumber));
  if (!content) return {};
  const { chapter } = content;
  return {
    title: `${chapter.name_simple} — IqraSpace Quran`,
    description: `Read Surah ${chapter.name_simple} (${chapter.translated_name.name}), ${chapter.verses_count} ayahs, with translation.`,
    alternates: { canonical: canonicalUrl(`/surah/${chapter.id}`) },
  };
}

export default async function SurahPage({ params }: Props) {
  const { surahNumber } = await params;
  const number = Number(surahNumber);
  const content = getSurahContent(number);

  if (!content) {
    notFound();
  }

  const { previous, next } = getAdjacentSurahs(number);

  return <SurahReader chapter={content.chapter} verses={content.verses} previous={previous} next={next} />;
}
