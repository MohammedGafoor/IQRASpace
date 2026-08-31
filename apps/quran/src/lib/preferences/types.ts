/**
 * Reader preferences (Readme.md §10/§11) — deliberately the same shape as
 * supabase/migrations/0001_init_schema.sql's user_preferences table, so
 * Phase 5's "upgrade local data to synced data" (ARCHITECTURE.md §5) is a
 * direct mapping, not a translation layer.
 */
export type Theme = "light" | "dark" | "system";
export type ReadingWidth = "narrow" | "comfortable" | "wide";

export type ReaderPreferences = {
  theme: Theme;
  arabicFontScale: number;
  translationFontScale: number;
  lineSpacing: number;
  readingWidth: ReadingWidth;
  translationVisible: boolean;
};

export const DEFAULT_PREFERENCES: ReaderPreferences = {
  theme: "system",
  arabicFontScale: 1,
  translationFontScale: 1,
  lineSpacing: 1,
  readingWidth: "comfortable",
  translationVisible: true,
};

export const FONT_SCALE_MIN = 0.75;
export const FONT_SCALE_MAX = 1.75;
export const FONT_SCALE_STEP = 0.125;

export const LINE_SPACING_MIN = 0.85;
export const LINE_SPACING_MAX = 1.5;
export const LINE_SPACING_STEP = 0.125;
