"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
import { ARABIC_FONTS, ARABIC_FONT_GROUPS, arabicFontLabel, type ArabicFontId } from "@/lib/content/arabicFonts";
import { STOP_SYMBOLS, TAJWEED_RULES } from "@/lib/content/tajweedRules";

const READING_WIDTHS: { value: ReadingWidth; label: string }[] = [
  { value: "narrow", label: "Narrow" },
  { value: "comfortable", label: "Comfortable" },
  { value: "wide", label: "Wide" },
];

const ARABIC_FONT_CSS_VAR: Record<ArabicFontId, string> = {
  amiri: "var(--font-arabic-amiri)",
  amiriQuran: "var(--font-arabic-amiriquran)",
  scheherazade: "var(--font-arabic-scheherazade)",
  lateef: "var(--font-arabic-lateef)",
  notoNaskh: "var(--font-arabic-notonaskh)",
};

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

type View = "main" | "arabicFont" | "tajweedRules";

/**
 * Settings entry point + panel for the reading surface (Prompt: "Separate
 * Settings from Quran Content"). Everything ReaderToolbar used to show
 * inline — font size/zoom, translation size, line spacing, page width,
 * translation language, Show Bookmarks — plus the Arabic font picker now
 * lives behind one gear icon, so Surah/Page readers stay a minimal,
 * distraction-free reading experience by default (Readme.md §11).
 *
 * Every row applies live and persists immediately (see
 * ReaderPreferencesProvider) EXCEPT the Arabic Font picker, which — to
 * match the reference screenshots' explicit Cancel/Save drill-down — is
 * the one control with local draft state, committed only on Save.
 *
 * Tajweed Rules (a read-only reference, nothing to persist) is its own
 * drill-down sub-view too, at the top of the main list — this used to be
 * a separate route (app/tajweed-rules/page.tsx) but moved in-panel so
 * opening it never navigates away from the Surah/Page reader
 * underneath.
 */
export function ReaderSettingsPanel() {
  const { preferences, setPreference } = useReaderPreferences();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("main");
  const [draftFont, setDraftFont] = useState<ArabicFontId>(preferences.arabicFont);
  const [showFontHelp, setShowFontHelp] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  function close() {
    setOpen(false);
    setView("main");
    triggerRef.current?.focus();
  }

  function openFontPicker() {
    setDraftFont(preferences.arabicFont);
    setShowFontHelp(false);
    setView("arabicFont");
  }

  function saveFontPicker() {
    setPreference("arabicFont", draftFont);
    setView("main");
  }

  function openTajweedRules() {
    setView("tajweedRules");
  }

  // Escape-to-close, a lightweight Tab focus trap while the panel is open,
  // and a body-scroll lock (the panel can be taller than the viewport on
  // phones, where it's a bottom sheet rather than a side panel).
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    panelRef.current?.focus();
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label="Reading settings"
        style={triggerStyle}
      >
        <GearIcon />
        <span>Settings</span>
      </button>

      {open &&
        createPortal(
          <>
            <div className="settings-backdrop" onClick={close} aria-hidden="true" />
            <div
              ref={panelRef}
              className="settings-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby={headingId}
              tabIndex={-1}
            >
              {view === "main" ? (
                <>
                  <div style={panelHeaderStyle}>
                    <h2 id={headingId} style={{ margin: 0, fontSize: "1.05rem" }}>
                      Reading Settings
                    </h2>
                    <button type="button" onClick={close} aria-label="Close settings" style={iconButtonStyle}>
                      <CloseIcon />
                    </button>
                  </div>

                  <div className="settings-panel-body">
                    <button type="button" onClick={openTajweedRules} style={{ ...navRowStyle, marginTop: "1rem" }}>
                      <span>Tajweed Rules</span>
                      <span style={navRowValueStyle}>
                        Stop signs, pronunciation rules
                        <ChevronIcon />
                      </span>
                    </button>

                    <section>
                      <SectionLabel>Font</SectionLabel>
                      <button type="button" onClick={openFontPicker} style={navRowStyle}>
                        <span>Arabic Font</span>
                        <span style={navRowValueStyle}>
                          {arabicFontLabel(preferences.arabicFont)}
                          <ChevronIcon />
                        </span>
                      </button>
                    </section>

                    <TextSizeSection />
                    <LayoutSection />
                    <TranslationSection />
                    <BookmarksSection />
                    <PdfModeSection />
                  </div>

                  <div style={panelFooterStyle}>
                    <button type="button" onClick={close} style={doneButtonStyle}>
                      Done
                    </button>
                  </div>
                </>
              ) : view === "arabicFont" ? (
                <>
                  <div style={panelHeaderStyle}>
                    <button type="button" onClick={() => setView("main")} aria-label="Back to settings" style={iconButtonStyle}>
                      <BackIcon />
                    </button>
                    <h2 id={headingId} style={{ margin: 0, fontSize: "1.05rem" }}>
                      Arabic Font
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowFontHelp((v) => !v)}
                      aria-expanded={showFontHelp}
                      aria-label="About Arabic fonts"
                      style={iconButtonStyle}
                    >
                      <HelpIcon />
                    </button>
                  </div>

                  {showFontHelp && (
                    <p style={fontHelpStyle}>
                      Uthmani / Madani faces follow classical Mushaf calligraphy. Naskh styles favor everyday
                      legibility over calligraphic exactness.
                    </p>
                  )}

                  <div className="settings-panel-body">
                    {ARABIC_FONT_GROUPS.map((group) => (
                      <section key={group}>
                        <SectionLabel>{group}</SectionLabel>
                        <div role="radiogroup" aria-label={group}>
                          {ARABIC_FONTS.filter((font) => font.group === group).map((font) => {
                            const selected = draftFont === font.id;
                            return (
                              <label key={font.id} style={fontRowStyle}>
                                <span style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                  <input
                                    type="radio"
                                    name="arabic-font"
                                    value={font.id}
                                    checked={selected}
                                    onChange={() => setDraftFont(font.id)}
                                  />
                                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{font.label}</span>
                                </span>
                                <span
                                  dir="rtl"
                                  lang="ar"
                                  aria-hidden="true"
                                  style={{
                                    fontFamily: ARABIC_FONT_CSS_VAR[font.id],
                                    fontSize: "1.35rem",
                                    color: "var(--color-text)",
                                  }}
                                >
                                  بِسْمِ ٱللَّٰهِ
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>

                  <div style={{ ...panelFooterStyle, display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                    <button type="button" onClick={() => setView("main")} style={cancelButtonStyle}>
                      Cancel
                    </button>
                    <button type="button" onClick={saveFontPicker} style={saveButtonStyle}>
                      Save
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={panelHeaderStyle}>
                    <button type="button" onClick={() => setView("main")} aria-label="Back to settings" style={iconButtonStyle}>
                      <BackIcon />
                    </button>
                    <h2 id={headingId} style={{ margin: 0, fontSize: "1.05rem" }}>
                      Tajweed Rules
                    </h2>
                    <span aria-hidden="true" style={{ width: "2.25rem", flexShrink: 0 }} />
                  </div>

                  <div className="settings-panel-body">
                    <TajweedRulesList />
                  </div>
                </>
              )}
            </div>
          </>,
          document.body
        )}
    </>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 style={sectionLabelStyle}>{children}</h3>;
}

function TextSizeSection() {
  const { preferences, setPreference } = useReaderPreferences();
  const percent = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <section>
      <SectionLabel>Text</SectionLabel>
      <SliderControl
        label="Arabic text size"
        value={preferences.arabicFontScale}
        min={FONT_SCALE_MIN}
        max={FONT_SCALE_MAX}
        step={FONT_SCALE_STEP}
        formatValue={percent}
        onChange={(v) => setPreference("arabicFontScale", v)}
      />
      <SliderControl
        label="Translation text size"
        value={preferences.translationFontScale}
        min={FONT_SCALE_MIN}
        max={FONT_SCALE_MAX}
        step={FONT_SCALE_STEP}
        formatValue={percent}
        onChange={(v) => setPreference("translationFontScale", v)}
      />
      <SliderControl
        label="Line spacing"
        value={preferences.lineSpacing}
        min={LINE_SPACING_MIN}
        max={LINE_SPACING_MAX}
        step={LINE_SPACING_STEP}
        formatValue={percent}
        onChange={(v) => setPreference("lineSpacing", v)}
      />
    </section>
  );
}

function LayoutSection() {
  const { preferences, setPreference } = useReaderPreferences();

  return (
    <section>
      <SectionLabel>Layout</SectionLabel>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", padding: "0.5rem 0" }}>
        <span>Page width</span>
        <div role="radiogroup" aria-label="Page width" style={{ display: "flex", gap: "0.35rem" }}>
          {READING_WIDTHS.map((w) => {
            const selected = preferences.readingWidth === w.value;
            return (
              <button
                key={w.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPreference("readingWidth", w.value)}
                style={segmentButtonStyle(selected)}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TranslationSection() {
  const { preferences, setPreference } = useReaderPreferences();

  return (
    <section>
      <SectionLabel>Translation</SectionLabel>
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
        Hidden by default — turn on a language to show it under each Ayah.
      </p>
      {TRANSLATION_LANGUAGES.map((lang) => (
        <ToggleRow
          key={lang.id}
          label={lang.label}
          checked={preferences.enabledTranslations.includes(lang.id)}
          onChange={(checked) => {
            const next = checked
              ? [...preferences.enabledTranslations, lang.id]
              : preferences.enabledTranslations.filter((id) => id !== lang.id);
            setPreference("enabledTranslations", next);
          }}
        />
      ))}
    </section>
  );
}

function BookmarksSection() {
  const { preferences, setPreference } = useReaderPreferences();

  return (
    <section>
      <SectionLabel>Bookmarks</SectionLabel>
      <ToggleRow
        label="Show Bookmarks"
        checked={preferences.showBookmarks}
        onChange={(checked) => setPreference("showBookmarks", checked)}
      />
    </section>
  );
}

function PdfModeSection() {
  const { preferences, setPreference } = useReaderPreferences();

  return (
    <section>
      <SectionLabel>Reading View</SectionLabel>
      <ToggleRow
        label="PDF Mode"
        checked={preferences.pdfMode}
        onChange={(checked) => setPreference("pdfMode", checked)}
      />
      <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
        Shows the original scanned Mushaf pages instead of typeset text. Applies to Surah view only.
      </p>
    </section>
  );
}

/**
 * Content for the Tajweed Rules sub-view: Quranic stop signs (waqf) and
 * core pronunciation rules, each with one example Ayah. A teaching
 * reference (one representative example per rule, only that rule's own
 * trigger letters highlighted) — not a live per-Ayah-annotated reader:
 * this app's content pipeline doesn't sync tajweed-annotated verse text
 * (PRODUCT-ROADMAP.md).
 */
function TajweedRulesList() {
  return (
    <>
      <section>
        <SectionLabel>Stop Symbols</SectionLabel>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {STOP_SYMBOLS.map((s) => (
            <li key={s.label} style={stopRowStyle}>
              <span aria-hidden="true" style={badgeStyle(s.color)}>
                {s.symbol}
              </span>
              <span style={{ flex: 1, fontWeight: 600 }}>{s.label}</span>
              <span style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
                found {s.count.toLocaleString("en-US")} times
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <SectionLabel>Tajweed Rules</SectionLabel>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {TAJWEED_RULES.map((rule) => (
            <li key={rule.id} style={ruleCardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span aria-hidden="true" style={swatchStyle(rule.color)} />
                <h4 style={{ margin: 0, fontSize: "0.95rem", flex: 1 }}>{rule.name}</h4>
                <PlayGlyph color={rule.color} />
              </div>
              <p style={descriptionStyle}>{rule.description}</p>
              <p dir="rtl" lang="ar" style={exampleStyle}>
                {rule.example.map((segment, i) => (
                  <span key={i} style={segment.highlighted ? { color: rule.color, fontWeight: 700 } : undefined}>
                    {segment.text}
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** Decorative only — there's no audio source wired up for these examples,
    so this is a plain (non-interactive, non-focusable) glyph rather than
    a button that looks clickable but does nothing. */
function PlayGlyph({ color }: { color: string }) {
  return (
    <span aria-hidden="true" style={playGlyphStyle(color)}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z" />
      </svg>
    </span>
  );
}

function SliderControl({
  label,
  value,
  onChange,
  min,
  max,
  step,
  formatValue,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  formatValue: (value: number) => string;
}) {
  const id = useId();
  return (
    <div style={{ padding: "0.55rem 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
        <label htmlFor={id}>{label}</label>
        <span style={{ color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums" }}>
          {formatValue(value)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--color-primary)" }}
      />
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0", cursor: "pointer" }}>
      <span>{label}</span>
      <span style={{ position: "relative", display: "inline-block", width: "2.5rem", height: "1.5rem", flexShrink: 0 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", margin: 0 }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "9999px",
            background: checked ? "var(--color-primary)" : "var(--color-border)",
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "0.15rem",
            left: checked ? "1.15rem" : "0.15rem",
            width: "1.2rem",
            height: "1.2rem",
            borderRadius: "9999px",
            background: "#fff",
            boxShadow: "0 1px 2px rgb(0 0 0 / 25%)",
            transition: "left 0.15s ease",
          }}
        />
      </span>
    </label>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2-2.4 3.4" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

const triggerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  border: "1px solid var(--color-border)",
  borderRadius: "0.375rem",
  padding: "0.4rem 0.75rem",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
  fontSize: "0.85rem",
};

const iconButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "2.25rem",
  height: "2.25rem",
  border: "none",
  borderRadius: "0.375rem",
  background: "transparent",
  color: "var(--color-text)",
  cursor: "pointer",
  flexShrink: 0,
};

const doneButtonStyle: CSSProperties = {
  width: "100%",
  padding: "0.65rem",
  borderRadius: "0.5rem",
  border: "none",
  background: "var(--color-primary)",
  color: "var(--color-primary-contrast)",
  fontSize: "0.9rem",
  fontWeight: 600,
  cursor: "pointer",
};

const saveButtonStyle: CSSProperties = {
  ...doneButtonStyle,
  width: "auto",
  padding: "0.55rem 1.75rem",
};

const cancelButtonStyle: CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--color-text-muted)",
  fontSize: "0.9rem",
  cursor: "pointer",
  padding: "0.55rem 0.5rem",
};

const navRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  padding: "0.6rem 0",
  background: "none",
  border: "none",
  borderBottom: "1px solid var(--color-border)",
  color: "var(--color-text)",
  fontSize: "0.9rem",
  cursor: "pointer",
  textAlign: "left",
  textDecoration: "none",
};

const navRowValueStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.35rem",
  color: "var(--color-text-muted)",
  fontSize: "0.8rem",
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  padding: "1.1rem 1.25rem 0.75rem",
  borderBottom: "1px solid var(--color-border)",
  flexShrink: 0,
};

const panelFooterStyle: CSSProperties = {
  padding: "0.9rem 1.25rem",
  borderTop: "1px solid var(--color-border)",
  flexShrink: 0,
};

const fontHelpStyle: CSSProperties = {
  margin: "0 1.25rem 0.75rem",
  fontSize: "0.8rem",
  color: "var(--color-text-muted)",
  flexShrink: 0,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--color-accent-text)",
  margin: "1.5rem 0 0.5rem",
};

const fontRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  padding: "0.75rem 0",
  borderBottom: "1px solid var(--color-border)",
  cursor: "pointer",
};

function segmentButtonStyle(selected: boolean): CSSProperties {
  return {
    border: `1px solid ${selected ? "var(--color-primary)" : "var(--color-border)"}`,
    background: selected ? "var(--color-primary)" : "var(--color-bg)",
    color: selected ? "var(--color-primary-contrast)" : "var(--color-text)",
    borderRadius: "0.375rem",
    padding: "0.3rem 0.6rem",
    fontSize: "0.8rem",
    cursor: "pointer",
  };
}

const stopRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.65rem 0",
  borderBottom: "1px solid var(--color-border)",
};

const ruleCardStyle: CSSProperties = {
  padding: "0.85rem 0",
  borderBottom: "1px solid var(--color-border)",
};

const descriptionStyle: CSSProperties = {
  margin: "0.5rem 0 0.75rem",
  color: "var(--color-text)",
  fontSize: "0.85rem",
  lineHeight: 1.5,
  whiteSpace: "pre-line",
};

const exampleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-arabic)",
  fontSize: "1.3rem",
  lineHeight: 1.9,
  color: "var(--color-text)",
};

function badgeStyle(color: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "2.25rem",
    height: "2.25rem",
    borderRadius: "9999px",
    background: color,
    color: "#fff",
    fontFamily: "var(--font-arabic)",
    fontSize: "0.9rem",
    flexShrink: 0,
  };
}

function swatchStyle(color: string): CSSProperties {
  return {
    display: "inline-block",
    width: "1.1rem",
    height: "1.1rem",
    borderRadius: "0.3rem",
    background: color,
    flexShrink: 0,
  };
}

function playGlyphStyle(color: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "1.5rem",
    height: "1.5rem",
    borderRadius: "9999px",
    border: `1.5px solid ${color}`,
    color,
    flexShrink: 0,
  };
}
