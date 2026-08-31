import { DEFAULT_PREFERENCES, type ReaderPreferences } from "./types";

/**
 * Local-device storage for reader preferences and reading position — this
 * is what makes reading/bookmarking/continuing work with zero account
 * (Readme.md §9, ARCHITECTURE.md §5). All access is guarded for SSR
 * (localStorage doesn't exist on the server) and wrapped in try/catch —
 * a private-browsing mode or blocked site data should degrade to
 * defaults, never crash the reader (Readme.md §42's resilience principle
 * applied to local storage too, not just the network).
 */

const PREFERENCES_KEY = "iqraspace-quran:preferences";
const LAST_POSITION_KEY = "iqraspace-quran:last-position";
const BOOKMARKS_KEY = "iqraspace-quran:bookmarks";

export function loadPreferences(): ReaderPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<ReaderPreferences>) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: ReaderPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable (private mode, quota, blocked site data) — the
    // reader still works, it just won't remember this change.
  }
}

export type ReadingPosition = {
  surahNumber: number;
  ayahNumber: number;
  updatedAt: string;
};

export function loadLastPosition(): ReadingPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_POSITION_KEY);
    return raw ? (JSON.parse(raw) as ReadingPosition) : null;
  } catch {
    return null;
  }
}

export function saveLastPosition(position: Omit<ReadingPosition, "updatedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const value: ReadingPosition = { ...position, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(LAST_POSITION_KEY, JSON.stringify(value));
  } catch {
    // Same as savePreferences — non-fatal.
  }
}

export type BookmarkKey = string; // `${surahNumber}:${ayahNumber}`, matches verse_key shape

export function loadBookmarks(): BookmarkKey[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BOOKMARKS_KEY);
    return raw ? (JSON.parse(raw) as BookmarkKey[]) : [];
  } catch {
    return [];
  }
}

export function toggleBookmark(key: BookmarkKey): BookmarkKey[] {
  const current = loadBookmarks();
  const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
    } catch {
      // Non-fatal — see above.
    }
  }
  return next;
}
