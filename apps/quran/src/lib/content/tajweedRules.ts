/**
 * Static Tajweed reference data for the Tajweed Rules sub-view of Settings
 * (components/reader/ReaderSettingsPanel.tsx's TajweedRulesList). This is
 * a teaching reference — one representative example Ayah per rule with
 * only that rule's own trigger letters highlighted — not a live
 * per-Ayah-annotated reader: this app's content pipeline doesn't sync
 * tajweed-annotated verse text (PRODUCT-ROADMAP.md), so building a
 * Tajweed-colored Mushaf across the whole Quran is future work, not this
 * view's job.
 *
 * Stop-sign (waqf) occurrence counts and the rule/example set match the
 * reference material this was modeled on.
 */

export type StopSymbol = {
  /** The actual Waqf glyph printed in the Mushaf margin for this sign. */
  symbol: string;
  label: string;
  count: number;
  color: string;
};

export const STOP_SYMBOLS: readonly StopSymbol[] = [
  { symbol: "مـ", label: "Must Stop", count: 22, color: "#c0392b" },
  { symbol: "قلى", label: "Better to stop", count: 603, color: "#c0652b" },
  { symbol: "⁘", label: "Pause at one", count: 12, color: "#d98a2b" },
  { symbol: "س", label: "A slight pause", count: 7, color: "#b8901f" },
  { symbol: "ج", label: "Stop or Continue", count: 1972, color: "#3b9e8f" },
  { symbol: "صلى", label: "Better to continue", count: 1682, color: "#2f7d4f" },
  { symbol: "لا", label: "Don't Stop", count: 68, color: "#5cae6a" },
];

/** One chunk of an example Ayah — `highlighted` marks the letters that
    actually trigger the rule, colored with the rule's own `color`. */
export type TajweedExampleSegment = { text: string; highlighted?: boolean };

export type TajweedRule = {
  id: string;
  name: string;
  color: string;
  description: string;
  example: readonly TajweedExampleSegment[];
};

export const TAJWEED_RULES: readonly TajweedRule[] = [
  {
    id: "ghunna",
    name: "Ghunna (Nasalisation)",
    color: "#e08a2e",
    description: "Any نّ or مّ will have a sound that emanates from the nose.",
    example: [
      { text: "إِ" },
      { text: "نَّ", highlighted: true },
      { text: "هَا عَلَيْهِمْ " },
      { text: "مُّ", highlighted: true },
      { text: "ؤْصَدَةٌ" },
    ],
  },
  {
    id: "ikhfa",
    name: `"Ikhfa'a (Lenition/Hiding)"`,
    color: "#c0392b",
    description:
      "Any نْ or ـًـٍـٌ followed by any of these letters ک ق ف ظ ط ض ص ش س ز ذ ج ث ت will be pronounced with a slight nasal sound\n\nOR\n\nWhen the letter ب appears after a مْ it will be pronounced with a light nasal sound in the nose.",
    example: [
      { text: "تَرْمِيهِ" },
      { text: "م", highlighted: true },
      { text: " " },
      { text: "بِ", highlighted: true },
      { text: "حِجَارَةٍ مِّن سِجِّيلٍ" },
    ],
  },
  {
    id: "idgham",
    name: "Idgham (Elision/Merging)",
    color: "#9b3fa8",
    description:
      "Any نْ or ـًـٍـٌ followed by any of these letters و ن م ي will become assimilated into the following letter and will be read with Ghunna\n\nOR\n\nWhen a نْ is followed by مْ, the former will become incorporated into the latter and will be read with Ghunna.",
    example: [
      { text: "الَّذِي أَطْعَمَهُ" },
      { text: "م مِّن", highlighted: true },
      { text: " جُوعٍ وَآمَنَهُ" },
      { text: "م مِّنْ", highlighted: true },
      { text: " خَوْفٍ" },
    ],
  },
  {
    id: "idgham-no-ghunna",
    name: "Idgham without Ghunna",
    color: "#9aa0a6",
    description:
      "Any نْ or ـًـٍـٌ followed by the letter ل or ر will become assimilated into the following letter but the ghunna will not be pronounced.",
    example: [{ text: "وَلَمْ يَكُ" }, { text: "ن لَّ", highlighted: true }, { text: "هُ كُفُوًا أَحَدٌ" }],
  },
  {
    id: "iqlab",
    name: "Iqlab (Assimilation/Flipping)",
    color: "#2e5fc4",
    description: "Any نْ or ـًـٍـٌ followed by ب will change into a مْ.",
    example: [{ text: "كَذَّبَتْ ثَمُودُ وَعَا" }, { text: "دٌ بِ", highlighted: true }, { text: "الْقَارِعَةِ" }],
  },
  {
    id: "qalqala",
    name: "Qalqala (Echoing)",
    color: "#2fa84f",
    description:
      "Any of these five letters ق ط ب ج د when encountered with a Sukun, or as the last letter of the verse, need to be recited with a slight echoing or jerking sound.",
    example: [
      { text: "لَمْ يَلِ" },
      { text: "دْ", highlighted: true },
      { text: " وَلَمْ يُولَ" },
      { text: "دْ", highlighted: true },
    ],
  },
];
