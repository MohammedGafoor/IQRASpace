/**
 * Translation languages this app ships, mapped to the Quran Foundation
 * `resource_id` synced into every verse's `translations[]` array (see
 * scripts/sync-content.mjs's TRANSLATION_RESOURCE_IDS — keep both lists
 * in sync; this is the single source of truth the reader UI reads from).
 *
 * Roman Urdu (831, "Abul Ala Maududi (Roman Urdu)") was added per the
 * home-page/reader fix pass — confirmed via the Content API's own
 * /resources/translations metadata and a real verse's text (Latin-script
 * "Allah ke naam se jo Rehman o Raheem hai...", not Arabic-script Urdu).
 */
export type TranslationLanguageId = "english" | "roman-urdu";

export type TranslationLanguage = {
  id: TranslationLanguageId;
  /** Matches VerseTranslation.resource_id in the synced content. */
  resourceId: number;
  label: string;
};

export const TRANSLATION_LANGUAGES: readonly TranslationLanguage[] = [
  { id: "english", resourceId: 85, label: "English" },
  { id: "roman-urdu", resourceId: 831, label: "Roman Urdu" },
];

export function translationLanguageLabel(id: TranslationLanguageId): string {
  return TRANSLATION_LANGUAGES.find((l) => l.id === id)?.label ?? id;
}
