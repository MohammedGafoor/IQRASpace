/**
 * Arabic Quran-text fonts this app ships, mapped to the CSS custom
 * property each one is loaded under (see app/layout.tsx's next/font/google
 * declarations and globals.css's `--font-arabic-*` / `data-arabic-font`
 * wiring). Mirrors lib/content/translations.ts's shape/role: the single
 * source of truth the settings UI reads from.
 *
 * Grouped the way the Settings > Arabic Font picker presents them:
 *  - "Uthmani / Madani": Amiri and Amiri Quran both reproduce classical
 *    Uthmani Mushaf calligraphy (Amiri was originally drawn to match the
 *    1924 Cairo Amiri Press Quran; Amiri Quran is its Quran-text-tuned
 *    sibling) — both open (OFL-1.1) and available via next/font/google,
 *    same as every other font here.
 *  - "Naskh Styles": Scheherazade New / Lateef / Noto Naskh Arabic are
 *    general open Naskh faces, good for sustained reading but not
 *    specifically Mushaf calligraphy.
 *
 * Deliberately no "IndoPak / Asian" group (Noorehuda/Noorani-Quran-style
 * fonts): those render Indo-Pak Mushaf orthography, which needs different
 * verse text (text_indopak) that this app's content pipeline doesn't sync
 * — only text_uthmani exists (lib/content/types.ts). Applying an IndoPak
 * font to Uthmani-script text would misrender letterforms, so this was
 * intentionally left out rather than shipped broken; add it once
 * text_indopak is available.
 */
export type ArabicFontId = "amiri" | "amiriQuran" | "scheherazade" | "lateef" | "notoNaskh";

export type ArabicFontGroup = "Uthmani / Madani" | "Naskh Styles";

export const ARABIC_FONT_GROUPS: readonly ArabicFontGroup[] = ["Uthmani / Madani", "Naskh Styles"];

export type ArabicFont = {
  id: ArabicFontId;
  label: string;
  description: string;
  group: ArabicFontGroup;
};

export const ARABIC_FONTS: readonly ArabicFont[] = [
  { id: "amiri", label: "Amiri", description: "Classic Naskh — warm, traditional", group: "Uthmani / Madani" },
  {
    id: "amiriQuran",
    label: "Amiri Quran",
    description: "Uthmani Mushaf calligraphy, tuned for Quran text",
    group: "Uthmani / Madani",
  },
  {
    id: "scheherazade",
    label: "Scheherazade",
    description: "Traditional Naskh — wide, generous letterforms",
    group: "Naskh Styles",
  },
  { id: "lateef", label: "Lateef", description: "Naskh — clear at small sizes", group: "Naskh Styles" },
  { id: "notoNaskh", label: "Noto Naskh", description: "Clean, modern Naskh", group: "Naskh Styles" },
];

export function arabicFontLabel(id: ArabicFontId): string {
  return ARABIC_FONTS.find((f) => f.id === id)?.label ?? id;
}
