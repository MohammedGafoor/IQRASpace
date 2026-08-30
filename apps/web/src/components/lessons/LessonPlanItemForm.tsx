"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import { QURAN_SURAHS } from "@/lib/quranContent";
import { listLessonMaterials, uploadLessonMaterial, type StoredFile } from "@/lib/storage";
import type { LessonPlanItem } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

const NEW_FILE = "__upload_new__";

/**
 * Create/edit a single Universal Lesson Plan item. Sequencing and the
 * previous-item prerequisite link are decided by the caller (the Lesson
 * Library page) — this form only edits the item's own curriculum content.
 */
export function LessonPlanItemForm({
  uploaderId,
  lessonPlanId,
  item,
  nextSequence,
  prerequisiteItemId,
  onSaved,
  onCancel,
}: {
  uploaderId: string;
  lessonPlanId: string;
  item?: LessonPlanItem | null;
  nextSequence: number;
  prerequisiteItemId: string | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { showToast } = useToast();

  const [title, setTitle] = useState(item?.title ?? "");
  const [objective, setObjective] = useState(item?.objective ?? "");
  const [surahKey, setSurahKey] = useState(item?.quran_surah_key ?? "");
  const [materialChoice, setMaterialChoice] = useState(item?.material_storage_path ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [pageStart, setPageStart] = useState(item?.material_page_start?.toString() ?? "");
  const [pageEnd, setPageEnd] = useState(item?.material_page_end?.toString() ?? "");
  const [active, setActive] = useState(item?.active ?? true);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listLessonMaterials(uploaderId).then(setFiles);
  }, [uploaderId]);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    let storagePath = materialChoice === NEW_FILE ? "" : materialChoice;
    if (materialChoice === NEW_FILE && file) {
      const { path, error } = await uploadLessonMaterial(uploaderId, file);
      if (error) {
        setSaving(false);
        showToast(error.message);
        return;
      }
      storagePath = path;
    }

    const payload = {
      title,
      objective: objective || null,
      quran_surah_key: surahKey || null,
      material_storage_path: storagePath || null,
      material_type: storagePath ? "pdf" : null,
      material_page_start: storagePath && pageStart ? Number(pageStart) : null,
      material_page_end: storagePath && pageEnd ? Number(pageEnd) : null,
      active,
    };

    const { error } = item
      ? await supabase.from("lesson_plan_items").update(payload).eq("id", item.id)
      : await supabase.from("lesson_plan_items").insert({
          ...payload,
          lesson_plan_id: lessonPlanId,
          sequence: nextSequence,
          prerequisite_item_id: prerequisiteItemId,
        });

    setSaving(false);
    if (error) {
      showToast(error.message);
      return;
    }
    showToast(item ? "Lesson updated" : "Lesson added to the plan");
    onSaved();
  }

  const showMaterialFields = Boolean(materialChoice);

  return (
    <form onSubmit={handleSubmit} className="grid gap-3.5">
      <Field label="Lesson title">
        <Input required placeholder="Lesson 7 — Zabar (Fatha)" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Objective / description" hint="What should the student be able to do after this lesson?">
        <Textarea value={objective} onChange={(e) => setObjective(e.target.value)} />
      </Field>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Qur'an content (for live sharing)">
          <Select value={surahKey} onChange={(e) => setSurahKey(e.target.value)}>
            <option value="">None</option>
            {QURAN_SURAHS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Material (PDF)">
          <Select value={materialChoice} onChange={(e) => setMaterialChoice(e.target.value)}>
            <option value="">None</option>
            {/* The item's current file may live outside this tutor's own folder
                (e.g. the seeded Qaida curriculum) — keep it selectable even if
                listLessonMaterials(uploaderId) doesn't return it. */}
            {item?.material_storage_path && !files.some((f) => f.path === item.material_storage_path) && (
              <option value={item.material_storage_path}>{item.material_storage_path.split("/").pop()}</option>
            )}
            {files.map((f) => (
              <option key={f.path} value={f.path}>
                {f.name}
              </option>
            ))}
            <option value={NEW_FILE}>＋ Upload new file…</option>
          </Select>
        </Field>
      </div>
      {materialChoice === NEW_FILE && (
        <Field label="Choose PDF">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
        </Field>
      )}
      {showMaterialFields && (
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Page start">
            <Input type="number" min={1} value={pageStart} onChange={(e) => setPageStart(e.target.value)} />
          </Field>
          <Field label="Page end">
            <Input type="number" min={1} value={pageEnd} onChange={(e) => setPageEnd(e.target.value)} />
          </Field>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active — visible to students and selectable when booking a session
      </label>
      <div className="flex gap-2.5">
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? "Saving…" : item ? "Save Changes" : "Add Lesson"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
