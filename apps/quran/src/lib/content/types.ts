/**
 * Shapes of the generated content in src/content/generated/ (gitignored,
 * produced by scripts/sync-content.mjs — see ARCHITECTURE.md §4). These
 * mirror the Quran Foundation Content API's own response shapes for the
 * fields we actually request (QURAN-CONTENT.md §2/§4a), not a redesigned
 * schema — kept close to the source so re-syncing never requires a type
 * migration unless the API itself changes.
 */

export type Chapter = {
  id: number;
  revelation_place: "makkah" | "madinah";
  revelation_order: number;
  bismillah_pre: boolean;
  name_simple: string;
  name_complex: string;
  name_arabic: string;
  verses_count: number;
  pages: [number, number];
  translated_name: {
    language_name: string;
    name: string;
  };
};

export type VerseTranslation = {
  id: number;
  resource_id: number;
  text: string;
};

export type Verse = {
  id: number;
  verse_number: number;
  verse_key: string; // e.g. "1:1"
  hizb_number: number;
  rub_el_hizb_number: number;
  ruku_number: number;
  manzil_number: number;
  sajdah_number: number | null;
  text_uthmani: string;
  page_number: number;
  /** Raw synced data (mirrors the upstream API's verse schema) — currently
      unused by any UI: the Juz browsing feature that once read this was
      removed (see PDF-CONTENT.md §8). Left in the data model rather than
      stripped out of sync-content.mjs's output, since it's real Quran
      structural metadata a future feature could still want. */
  juz_number: number;
  translations: VerseTranslation[];
};

export type SurahContent = {
  syncedAt: string;
  chapter: Chapter;
  verses: Verse[];
};

export type ChaptersIndex = {
  syncedAt: string;
  chapters: Chapter[];
};

/**
 * A verse annotated with which Surah it belongs to — needed anywhere a
 * view can span multiple Surahs (the Mushaf-page reader), since a bare
 * `Verse` only carries `verse_key` ("2:255"), not the Surah's name/metadata.
 */
export type VerseWithSurah = Verse & {
  surahId: number;
  surahName: string;
};
