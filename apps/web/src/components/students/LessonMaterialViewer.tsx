"use client";

import { useState } from "react";
import { getSignedMaterialUrl } from "@/lib/storage";
import { getSurah } from "@/lib/quranContent";
import type { LessonPlanItem } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { PdfViewer } from "@/components/pdf/PdfViewer";
import { useToast } from "@/components/ui/Toast";

type ViewerState =
  | { kind: "pdf"; url: string; page: number; title: string }
  | { kind: "surah"; title: string; surahName: string; objective: string | null };

/**
 * Opens a student's current Universal Lesson Plan item as a standalone
 * preview — no scheduled session required. This is the "Launch Lesson"
 * action shared by the Students card grid and the per-student curriculum
 * manager, so both open material exactly the same way `lessons/page.tsx`'s
 * own `openMaterial()` already does (same signed-URL + PdfViewer pattern).
 */
export function useLessonMaterialViewer() {
  const { showToast } = useToast();
  const [state, setState] = useState<ViewerState | null>(null);

  async function openItem(item: LessonPlanItem) {
    if (item.material_storage_path) {
      const { url, error } = await getSignedMaterialUrl(item.material_storage_path);
      if (error || !url) {
        showToast(error?.message ?? "Could not open material");
        return;
      }
      setState({ kind: "pdf", url, page: item.material_page_start ?? 1, title: item.title });
      return;
    }
    if (item.quran_surah_key) {
      const surah = getSurah(item.quran_surah_key);
      setState({
        kind: "surah",
        title: item.title,
        surahName: surah?.name ?? item.quran_surah_key,
        objective: item.objective,
      });
      return;
    }
    showToast("No material attached to this lesson yet");
  }

  const modal = (
    <Modal open={!!state} onClose={() => setState(null)} wide={state?.kind === "pdf"}>
      {state?.kind === "pdf" && <PdfViewer url={state.url} initialPage={state.page} />}
      {state?.kind === "surah" && (
        <div>
          <h3 className="text-base font-semibold">{state.title}</h3>
          <p className="mt-2 text-sm text-ink-soft">Qur&rsquo;an: {state.surahName}</p>
          {state.objective && <p className="mt-2 text-sm text-ink-soft">{state.objective}</p>}
          <p className="mt-3 text-xs text-muted">
            Live Ayah highlighting for students is available from a scheduled session&rsquo;s Teach screen.
          </p>
        </div>
      )}
    </Modal>
  );

  return { openItem, modal };
}
