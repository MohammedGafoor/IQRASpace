import { readFileSync } from "node:fs";
import path from "node:path";
import type { Chapter, ChaptersIndex, SurahContent, VerseWithSurah } from "./types";

/**
 * Server-only content loader, reading the static JSON produced by
 * scripts/sync-content.mjs (ARCHITECTURE.md §4 — the app never calls the
 * Quran Foundation API directly at request time). Plain node:fs reads,
 * not JSON imports — with 114 per-surah files, importing them all would
 * bundle every Surah into every page; reading by path loads only what a
 * given request actually needs.
 *
 * All 114 Surahs / 6,236 verses are synced as of production API access
 * (QURAN-CONTENT.md §4b) — but every function here still reflects
 * whatever is actually on disk, nothing hardcodes "114" or "6236", so
 * this keeps working unchanged if the dataset is ever smaller (e.g.
 * testing against pre-live again) or larger (a future API addition).
 */

const CONTENT_DIR = path.join(process.cwd(), "src", "content", "generated");

function readJson<T>(relativePath: string): T {
  const fullPath = path.join(CONTENT_DIR, relativePath);
  return JSON.parse(readFileSync(fullPath, "utf-8")) as T;
}

let chaptersCache: Chapter[] | null = null;

/**
 * Every Surah currently synced, in canonical order (1..n). Throws with a
 * clear message if the sync has never been run — a missing content
 * directory should never look like an empty-but-working Quran.
 */
export function getAllChapters(): Chapter[] {
  if (chaptersCache) return chaptersCache;
  try {
    const index = readJson<ChaptersIndex>("chapters.json");
    chaptersCache = [...index.chapters].sort((a, b) => a.id - b.id);
    return chaptersCache;
  } catch (err) {
    throw new Error(
      "No synced Quran content found (src/content/generated/chapters.json is missing). " +
        "Run `npm run sync:content` first — see QURAN-CONTENT.md §5 for credentials. " +
        `Original error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export function getChapter(number: number): Chapter | undefined {
  return getAllChapters().find((c) => c.id === number);
}

/** Full verse content (Uthmani text + translation) for one Surah. */
export function getSurahContent(number: number): SurahContent | undefined {
  try {
    return readJson<SurahContent>(`surah/${number}.json`);
  } catch {
    return undefined;
  }
}

/** The Surah before/after `number`, only among Surahs actually synced — not assuming all 114 exist (see module note above). */
export function getAdjacentSurahs(number: number): {
  previous: Chapter | undefined;
  next: Chapter | undefined;
} {
  const chapters = getAllChapters();
  const index = chapters.findIndex((c) => c.id === number);
  return {
    previous: index > 0 ? chapters[index - 1] : undefined,
    next: index >= 0 && index < chapters.length - 1 ? chapters[index + 1] : undefined,
  };
}

let flatVersesCache: VerseWithSurah[] | null = null;

/**
 * Every synced verse, across every Surah, in canonical Mushaf order
 * (Surah 1 ayah 1 → Surah 114's last ayah), each annotated with its
 * Surah id/name — the basis for Mushaf-page views, which cut across
 * Surah boundaries. Reads every per-surah file once and caches
 * the flattened result in memory for the life of the process/build.
 */
function getAllVersesWithSurah(): VerseWithSurah[] {
  if (flatVersesCache) return flatVersesCache;
  flatVersesCache = getAllChapters().flatMap((chapter) => {
    const content = getSurahContent(chapter.id);
    if (!content) return [];
    return content.verses.map((verse) => ({ ...verse, surahId: chapter.id, surahName: chapter.name_simple }));
  });
  return flatVersesCache;
}

/** Every Mushaf page number that actually has synced verses, in order. */
export function getPageNumbers(): number[] {
  return [...new Set(getAllVersesWithSurah().map((v) => v.page_number))].sort((a, b) => a - b);
}

/** Every verse on a given Mushaf page, across Surah boundaries, in Mushaf order. */
export function getVersesForPage(pageNumber: number): VerseWithSurah[] {
  return getAllVersesWithSurah().filter((v) => v.page_number === pageNumber);
}

export function getAdjacentPage(pageNumber: number): { previous: number | undefined; next: number | undefined } {
  const numbers = getPageNumbers();
  const index = numbers.indexOf(pageNumber);
  return {
    previous: index > 0 ? numbers[index - 1] : undefined,
    next: index >= 0 && index < numbers.length - 1 ? numbers[index + 1] : undefined,
  };
}
