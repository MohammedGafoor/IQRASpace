"use client";

import { useState, type SubmitEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { LessonPlan } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Badge";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

/** Plan switcher + "New Plan" for the Lesson Library — a tutor may run more
 * than one curriculum (e.g. Qaida, Tajweed, Hifz), each reusable across any
 * number of classes. */
export function LessonPlanPicker({
  plans,
  selectedId,
  onSelect,
  tutorId,
  onCreated,
}: {
  plans: LessonPlan[];
  selectedId: string;
  onSelect: (id: string) => void;
  tutorId: string;
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
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        ＋ New Plan
      </Button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <h3 className="mb-3 text-base font-semibold">New Lesson Plan</h3>
        <NewPlanForm
          tutorId={tutorId}
          onCreated={(id) => {
            setOpen(false);
            onCreated(id);
          }}
        />
      </Modal>
    </div>
  );
}

function NewPlanForm({ tutorId, onCreated }: { tutorId: string; onCreated: (id: string) => void }) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await supabase
      .from("lesson_plans")
      .insert({ tutor_id: tutorId, name, description: description || null })
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
      <Field label="Description" hint="Optional — shown to tutors managing this curriculum.">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Button type="submit" disabled={saving || !name}>
        {saving ? "Creating…" : "Create Plan"}
      </Button>
    </form>
  );
}
