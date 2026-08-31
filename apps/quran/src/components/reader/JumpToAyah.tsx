"use client";

import { useId, useState, type FormEvent } from "react";
import { ayahElementId } from "@/lib/reader/ayahDom";

type Props = {
  surahId: number;
  versesCount: number;
};

/**
 * "Ayah navigation" (Readme.md §10) — jump directly to an ayah within the
 * currently open Surah. Distinct from Phase 3's reference *search* (typing
 * "2:255" from anywhere) — this is the in-reader control for a Surah a
 * visitor already has open, so it ships now rather than waiting for
 * search.
 *
 * Looks the target ayah up by DOM id (see lib/reader/ayahDom.ts) and
 * scrolls to it directly — no dependency on AyahList's internal ref map,
 * so this stays a self-contained control.
 */
export function JumpToAyah({ surahId, versesCount }: Props) {
  const inputId = useId();
  const [value, setValue] = useState("");
  const [notFound, setNotFound] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ayahNumber = Math.min(Math.max(1, Math.round(Number(value))), versesCount);
    if (!Number.isFinite(ayahNumber) || ayahNumber < 1) {
      setNotFound(true);
      return;
    }
    const target = document.getElementById(ayahElementId(`${surahId}:${ayahNumber}`));
    if (!target) {
      setNotFound(true);
      return;
    }
    setNotFound(false);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.focus({ preventScroll: true });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}
    >
      <label htmlFor={inputId} style={{ color: "var(--color-text-muted)" }}>
        Go to Ayah
      </label>
      <input
        id={inputId}
        type="number"
        min={1}
        max={versesCount}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setNotFound(false);
        }}
        aria-describedby={notFound ? `${inputId}-error` : undefined}
        style={{
          width: "4rem",
          border: "1px solid var(--color-border)",
          borderRadius: "0.25rem",
          padding: "0.25rem 0.4rem",
          background: "var(--color-bg)",
          color: "var(--color-text)",
        }}
      />
      <button
        type="submit"
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "0.25rem",
          padding: "0.25rem 0.65rem",
          background: "var(--color-bg)",
          color: "var(--color-text)",
          cursor: "pointer",
        }}
      >
        Go
      </button>
      {notFound && (
        <span id={`${inputId}-error`} role="alert" style={{ color: "var(--color-accent-text)" }}>
          Enter 1–{versesCount}
        </span>
      )}
    </form>
  );
}
