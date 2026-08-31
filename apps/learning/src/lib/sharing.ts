import { supabase } from "./supabaseClient";

/**
 * Persistence side of live sharing (architecture §16's audit trail — every
 * highlight a tutor shares is recorded, not just broadcast). The broadcast
 * itself (lib/realtime.ts's HighlightState over the lesson:{id} channel) is
 * what makes it feel instant; these rows are the durable record.
 */
export async function getOrCreateActiveSession(lessonId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("sharing_sessions")
    .select("id")
    .eq("lesson_id", lessonId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from("sharing_sessions")
    .insert({ lesson_id: lessonId, status: "active" })
    .select("id")
    .single();

  if (error) {
    console.warn("getOrCreateActiveSession failed:", error.message);
    return null;
  }
  return data.id as string;
}

/**
 * `kind: "ayah"` — the bundled Qur'an-content lessons (lib/quranContent.ts),
 * `selectedText` is the ayah's Arabic text.
 * `kind: "pdf"` — a lesson with an attached PDF material (e.g. the Qaida –
 * Beginners curriculum, docs/qaida-beginners-curriculum.md), `selectedText`
 * is a human-readable label ("PDF page 7") since the actual highlight is
 * just "this whole page," not a specific word/rect within it (yet).
 */
export async function recordHighlight(
  sessionId: string,
  params: { pageNumber: number; selectedText: string; kind: "ayah" | "pdf" }
) {
  await supabase.from("highlighted_content").insert({
    sharing_session_id: sessionId,
    page_number: params.pageNumber,
    highlight_type: params.kind === "ayah" ? "ayah" : "rect",
    coordinates: { x: 0, y: 0, width: 1, height: 1 },
    selected_text: params.selectedText,
  });
}

/**
 * "Catch up" query for a student opening (or reloading) /share/[lessonId]
 * while a share is already in progress — Realtime broadcast has no replay,
 * so a listener that subscribes after the tutor's last broadcast would
 * otherwise see nothing until the tutor's next highlight. Falls back to the
 * last-persisted highlighted_content row for the lesson's active session.
 */
export async function getLatestHighlight(
  lessonId: string
): Promise<{ pageNumber: number; selectedText: string; kind: "ayah" | "pdf" } | null> {
  const { data: session } = await supabase
    .from("sharing_sessions")
    .select("id")
    .eq("lesson_id", lessonId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!session) return null;

  const { data: highlight } = await supabase
    .from("highlighted_content")
    .select("page_number, selected_text, highlight_type")
    .eq("sharing_session_id", session.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!highlight) return null;

  return {
    pageNumber: highlight.page_number as number,
    selectedText: (highlight.selected_text as string) ?? "",
    kind: highlight.highlight_type === "ayah" ? "ayah" : "pdf",
  };
}

export async function endSession(sessionId: string) {
  await supabase.from("sharing_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", sessionId);
}
