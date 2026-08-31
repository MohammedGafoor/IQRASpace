"use client";

import type { CSSProperties } from "react";
import { useReaderPreferences } from "@/lib/preferences/ReaderPreferencesProvider";
import {
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  FONT_SCALE_STEP,
  LINE_SPACING_MAX,
  LINE_SPACING_MIN,
  LINE_SPACING_STEP,
  type ReadingWidth,
} from "@/lib/preferences/types";
import { TRANSLATION_LANGUAGES } from "@/lib/content/translations";

const READING_WIDTHS: { value: ReadingWidth; label: string }[] = [
  { value: "narrow", label: "Narrow" },
  { value: "comfortable", label: "Comfortable" },
  { value: "wide", label: "Wide" },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Reader controls (Readme.md §10) — Arabic/translation font size, line
 * spacing, reading width, translation visibility. Deliberately not
 * overcrowded (§11): no advanced settings modal, everything fits in one
 * row/wrap on mobile.
 */
export function ReaderToolbar() {
  const { preferences, setPreference } = useReaderPreferences();

  return (
    <div
      role="group"
      aria-label="Reader settings"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.75rem",
        alignItems: "center",
        padding: "0.75rem 1rem",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "0.5rem",
        marginBottom: "1.5rem",
        fontSize: "0.85rem",
      }}
    >
      <FontScaleControl
        label="Arabic text"
        value={preferences.arabicFontScale}
        onChange={(v) => setPreference("arabicFontScale", v)}
      />
      <FontScaleControl
        label="Translation text"
        value={preferences.translationFontScale}
        onChange={(v) => setPreference("translationFontScale", v)}
      />
      <FontScaleControl
        label="Line spacing"
        value={preferences.lineSpacing}
        onChange={(v) => setPreference("lineSpacing", v)}
        min={LINE_SPACING_MIN}
        max={LINE_SPACING_MAX}
        step={LINE_SPACING_STEP}
      />

      <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        Width
        <select
          value={preferences.readingWidth}
          onChange={(e) => setPreference("readingWidth", e.target.value as ReadingWidth)}
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "0.25rem",
            padding: "0.2rem 0.4rem",
            background: "var(--color-bg)",
            color: "var(--color-text)",
          }}
        >
          {READING_WIDTHS.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>
      </label>

      <div role="group" aria-label="Translation" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span style={{ color: "var(--color-text-muted)" }}>Translation</span>
        {TRANSLATION_LANGUAGES.map((lang) => (
          <label key={lang.id} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <input
              type="checkbox"
              checked={preferences.enabledTranslations.includes(lang.id)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...preferences.enabledTranslations, lang.id]
                  : preferences.enabledTranslations.filter((id) => id !== lang.id);
                setPreference("enabledTranslations", next);
              }}
            />
            {lang.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function FontScaleControl({
  label,
  value,
  onChange,
  min = FONT_SCALE_MIN,
  max = FONT_SCALE_MAX,
  step = FONT_SCALE_STEP,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
      <span>{label}</span>
      <button
        type="button"
        aria-label={`Decrease ${label.toLowerCase()} size`}
        onClick={() => onChange(clamp(Math.round((value - step) * 1000) / 1000, min, max))}
        disabled={value <= min}
        style={buttonStyle}
      >
        −
      </button>
      <button
        type="button"
        aria-label={`Increase ${label.toLowerCase()} size`}
        onClick={() => onChange(clamp(Math.round((value + step) * 1000) / 1000, min, max))}
        disabled={value >= max}
        style={buttonStyle}
      >
        +
      </button>
    </div>
  );
}

// 2.25rem (36px) rather than the old 1.6rem (~25.6px) — comfortably above
// the WCAG 2.5.8 minimum tap target (24x24 CSS px) so zoom in/out is easy
// to hit precisely on a phone, not just technically clickable.
// touchAction: "manipulation" removes the ~300ms double-tap delay some
// mobile browsers add before firing click on a plain <button>.
const buttonStyle: CSSProperties = {
  width: "2.25rem",
  height: "2.25rem",
  lineHeight: 1,
  fontSize: "1rem",
  border: "1px solid var(--color-border)",
  borderRadius: "0.375rem",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
  touchAction: "manipulation",
};
