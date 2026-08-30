"use client";

import { useState, type SubmitEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { LessonPlan } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Badge";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

/** Plan switcher + "New Plan" for the Lesson Library — a universal
 * curriculum (0021_universal_lesson_plans.sql: not owned by any one tutor),
 * so any number of tutors can share the same set of plans (e.g. Qaida,
 * Tajweed, Hifz), each reusable across any number of classes. `canCreate`
 * gates the "+ New Plan" affordance — curriculum editing is admin-only;
 * tutors still get the switcher to browse/select among plans. */
export function LessonPlanPicker({
  plans,
  selectedId,
  onSelect,
  canCreate,
  onCreated,
}: {
  plans: LessonPlan[];
  selectedId: string;
  onSelect: (id: string) => void;
  canCreate: boolean;
  onCreated: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {plans.map((p) => (
        <Chip key={p.id} active={p.id === selectedId} onClick={() => onSelect(p.id)}>
          {p.name}
          {!p.active && " (inactive)"}
        </Chip>
      ))}
      {canCreate && (
        <>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            ＋ New Plan
          </Button>
          <Modal open={open} onClose={() => setOpen(false)}>
            <h3 className="mb-3 text-base font-semibold">New Lesson Plan</h3>
            <NewPlanForm
              onCreated={(id) => {
                setOpen(false);
                onCreated(id);
              }}
            />
          </Modal>
        </>
      )}
    </div>
  );
}

function NewPlanForm({ onCreated }: { onCreated: (id: string) => void }) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    // No tutor_id — this is a universal plan, not owned by whoever creates it.
    const { data, error } = await supabase
      .from("lesson_plans")
      .insert({ name, description: description || null })
      .select()
      .single();
    setSaving(false);
    if (error || !data) {
      showToast(error?.message ?? "Could not create plan");
      return;
    }
    showToast("Lesson plan created");
    onCreated(data.id);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3.5">
      <Field label="Plan name">
        <Input required placeholder="Qaida – Beginners" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Description" hint="Optional — shown to tutors browsing this curriculum.">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Button type="submit" disabled={saving || !name}>
        {saving ? "Creating…" : "Create Plan"}
      </Button>
    </form>
  );
}
