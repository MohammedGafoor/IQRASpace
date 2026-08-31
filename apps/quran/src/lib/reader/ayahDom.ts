/**
 * DOM element id for a given ayah, derived from its verse_key ("2:255").
 * Colons aren't valid unescaped in a CSS/DOM id lookup path some tooling
 * assumes, so this uses a dash instead ("ayah-2-255") — shared between
 * AyahBlock (sets the id) and JumpToAyah (looks it up), so they can't
 * drift out of sync with each other.
 */
export function ayahElementId(verseKey: string): string {
  return `ayah-${verseKey.replace(":", "-")}`;
}
