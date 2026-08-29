/**
 * Manual light/dark theme, persisted to localStorage. Works alongside
 * globals.css's `.dark` class rules and the `prefers-color-scheme` fallback
 * (for the no-JS/pre-hydration instant): "system" removes any override and
 * lets the media query decide; "light"/"dark" force a choice regardless of
 * the OS preference by also setting `data-theme` (globals.css's media block
 * is guarded with `:not([data-theme="light"])` so an explicit light choice
 * always wins over a dark system preference).
 */
export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "iqraspace-theme";

export function getStoredTheme(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

export function applyTheme(choice: ThemeChoice) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const systemPrefersDark =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const resolvedDark = choice === "dark" || (choice === "system" && systemPrefersDark);

  root.classList.toggle("dark", resolvedDark);
  if (choice === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", choice);
  }
}

export function setTheme(choice: ThemeChoice) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, choice);
  applyTheme(choice);
}

/** Inline, blocking script source (stringified) run from <head> before hydration to avoid a flash of the wrong theme. */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    var choice = stored === "light" || stored === "dark" ? stored : "system";
    var systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var dark = choice === "dark" || (choice === "system" && systemDark);
    var root = document.documentElement;
    if (dark) root.classList.add("dark");
    if (choice !== "system") root.setAttribute("data-theme", choice);
  } catch (e) {}
})();
`;
