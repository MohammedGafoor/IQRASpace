/**
 * A small bundled set of short, commonly-taught surahs used by the live
 * Teach/Share highlight-sync feature (architecture §7, §18). This is
 * reference text (public-domain Uthmani script), not user data — bundling it
 * is the same idea as the tutor demo's hardcoded `FATIHA` constant, just
 * covering a handful of surahs instead of one.
 *
 * A lesson opts into live highlighting by setting `quran_surah_key`
 * (supabase/migrations/0005_lesson_scheduling_and_quran.sql) to one of the
 * keys below. `page` groups ayahs for the Teach screen's page thumbnails.
 */

export type QuranAyah = {
  number: number;
  arabic: string;
  page: number;
};

export type SurahContent = {
  key: string;
  name: string;
  nameArabic: string;
  totalAyahs: number;
  ayahs: QuranAyah[];
};

export const QURAN_SURAHS: SurahContent[] = [
  {
    key: "al-fatiha",
    name: "Al-Fatiha",
    nameArabic: "الفاتحة",
    totalAyahs: 7,
    ayahs: [
      { number: 1, arabic: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", page: 1 },
      { number: 2, arabic: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ", page: 1 },
      { number: 3, arabic: "الرَّحْمَٰنِ الرَّحِيمِ", page: 1 },
      { number: 4, arabic: "مَالِكِ يَوْمِ الدِّينِ", page: 1 },
      { number: 5, arabic: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ", page: 2 },
      { number: 6, arabic: "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ", page: 2 },
      {
        number: 7,
        arabic:
          "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ",
        page: 2,
      },
    ],
  },
  {
    key: "al-ikhlas",
    name: "Al-Ikhlas",
    nameArabic: "الإخلاص",
    totalAyahs: 4,
    ayahs: [
      { number: 1, arabic: "قُلْ هُوَ اللَّهُ أَحَدٌ", page: 1 },
      { number: 2, arabic: "اللَّهُ الصَّمَدُ", page: 1 },
      { number: 3, arabic: "لَمْ يَلِدْ وَلَمْ يُولَدْ", page: 1 },
      { number: 4, arabic: "وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ", page: 1 },
    ],
  },
  {
    key: "al-falaq",
    name: "Al-Falaq",
    nameArabic: "الفلق",
    totalAyahs: 5,
    ayahs: [
      { number: 1, arabic: "قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ", page: 1 },
      { number: 2, arabic: "مِن شَرِّ مَا خَلَقَ", page: 1 },
      { number: 3, arabic: "وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ", page: 1 },
      { number: 4, arabic: "وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ", page: 1 },
      { number: 5, arabic: "وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ", page: 1 },
    ],
  },
  {
    key: "an-nas",
    name: "An-Nas",
    nameArabic: "الناس",
    totalAyahs: 6,
    ayahs: [
      { number: 1, arabic: "قُلْ أَعُوذُ بِرَبِّ النَّاسِ", page: 1 },
      { number: 2, arabic: "مَلِكِ النَّاسِ", page: 1 },
      { number: 3, arabic: "إِلَٰهِ النَّاسِ", page: 1 },
      { number: 4, arabic: "مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ", page: 1 },
      { number: 5, arabic: "الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ", page: 1 },
      { number: 6, arabic: "مِنَ الْجِنَّةِ وَالنَّاسِ", page: 1 },
    ],
  },
  {
    key: "al-asr",
    name: "Al-Asr",
    nameArabic: "العصر",
    totalAyahs: 3,
    ayahs: [
      { number: 1, arabic: "وَالْعَصْرِ", page: 1 },
      { number: 2, arabic: "إِنَّ الْإِنسَانَ لَفِي خُسْرٍ", page: 1 },
      {
        number: 3,
        arabic:
          "إِلَّا الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ وَتَوَاصَوْا بِالْحَقِّ وَتَوَاصَوْا بِالصَّبْرِ",
        page: 1,
      },
    ],
  },
];

export function getSurah(key: string | null | undefined): SurahContent | undefined {
  if (!key) return undefined;
  return QURAN_SURAHS.find((s) => s.key === key);
}

export function surahPageCount(surah: SurahContent): number {
  return Math.max(...surah.ayahs.map((a) => a.page));
}
