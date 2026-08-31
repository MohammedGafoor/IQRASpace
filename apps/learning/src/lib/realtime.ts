import { supabase } from "./supabaseClient";

/**
 * Highlight/page-sync state broadcast over a per-lesson Supabase Realtime
 * channel. Shape matches docs/architecture.md §7.2.
 *
 * Wired up fully in the Highlighting + Realtime phase — this file just
 * establishes the channel-naming convention and payload type so the teach/
 * share screens (Phase 3+) have a stable contract to build against.
 */
export type HighlightState = {
  lessonId: string;
  materialId: string;
  pageNumber: number;
  zoomLevel: number;
  scrollPosition: { x: number; y: number };
  highlightType: "rect" | "text" | "ayah";
  coordinates: { x: number; y: number; width: number; height: number };
  selectedText?: string;
  sessionStatus: "active" | "ended";
  updatedAt: string;
};

/** Realtime channel name is namespaced per lesson so sessions never cross classes. */
export function lessonChannelName(lessonId: string) {
  return `lesson:${lessonId}`;
}

export function getLessonChannel(lessonId: string) {
  return supabase.channel(lessonChannelName(lessonId));
}
