import { supabase } from "./supabaseClient";
import type { LessonMaterial } from "./types";

/**
 * Direct-upload lesson materials to Supabase Storage — the architecture §8
 * "simpler fallback... recommended for the very first MVP cut" over Google
 * Drive OAuth. Path convention: `{tutorId}/{filename}` (matches the RLS
 * policies in supabase/migrations/0011_storage_lesson_materials_bucket.sql).
 */
export const LESSON_MATERIALS_BUCKET = "lesson-materials";

export type StoredFile = {
  name: string;
  path: string;
  size: number;
  updatedAt: string;
};

export async function uploadLessonMaterial(tutorId: string, file: File) {
  const path = `${tutorId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from(LESSON_MATERIALS_BUCKET).upload(path, file, {
    contentType: file.type || "application/pdf",
  });
  return { path, error };
}

export async function listLessonMaterials(tutorId: string): Promise<StoredFile[]> {
  const { data, error } = await supabase.storage.from(LESSON_MATERIALS_BUCKET).list(tutorId, {
    sortBy: { column: "updated_at", order: "desc" },
  });
  if (error || !data) return [];
  return data
    .filter((f) => f.id) // Storage's `list` also returns folder placeholder entries with no id.
    .map((f) => ({
      name: f.name,
      path: `${tutorId}/${f.name}`,
      size: f.metadata?.size ?? 0,
      updatedAt: f.updated_at ?? f.created_at ?? "",
    }));
}

export async function getSignedMaterialUrl(path: string, expiresInSeconds = 3600) {
  const { data, error } = await supabase.storage
    .from(LESSON_MATERIALS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  return { url: data?.signedUrl ?? null, error };
}

/**
 * A lesson's attached PDF material (if any), used by the Teach/Share screens
 * to render the real material instead of the bundled-ayah view when a
 * lesson has no `quran_surah_key` — e.g. the Qaida – Beginners curriculum
 * (docs/qaida-beginners-curriculum.md), where every lesson points at a
 * specific page range of the same uploaded Noorani Qaida PDF.
 */
export async function getLessonMaterial(lessonId: string): Promise<LessonMaterial | null> {
  const { data } = await supabase
    .from("lesson_materials")
    .select("*")
    .eq("lesson_id", lessonId)
    .not("storage_path", "is", null)
    .order("id")
    .limit(1)
    .maybeSingle();
  return (data as LessonMaterial) ?? null;
}

export async function deleteLessonMaterial(path: string) {
  return supabase.storage.from(LESSON_MATERIALS_BUCKET).remove([path]);
}

export function formatFileSize(bytes: number) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
