"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import { getSignedMaterialUrl } from "@/lib/storage";
import type { ClassLessonPlan, ClassMember, ClassRow, LessonPlan, LessonPlanItem } from "@/lib/types";
import { Card, Eyebrow, SectionHead } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { LessonPlanPicker } from "@/components/lessons/LessonPlanPicker";
import { LessonPlanItemForm } from "@/components/lessons/LessonPlanItemForm";
import { PdfViewer } from "@/components/pdf/PdfViewer";

/**
 * Lesson Library — the Universal Lesson Plan (curriculum) manager. This
 * screen defines *what* should be taught and in what order; it deliberately
 * carries no date/time/duration/tutor-or-student-assignment fields — that's
 * Class/Session scheduling (/schedule), a separate concept. See the approved
 * redesign plan for the full rationale.
 */
export default function LessonsPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const isTutor = profile?.role === "tutor";

  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [items, setItems] = useState<LessonPlanItem[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classPlanByClassId, setClassPlanByClassId] = useState<Record<string, string>>({});
  const [assignedClasses, setAssignedClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [itemModal, setItemModal] = useState<{ item: LessonPlanItem | null } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [materialModal, setMaterialModal] = useState<{ url: string; page: number } | null>(null);

  const loadPlans = useCallback(async () => {
    const query = supabase.from("lesson_plans").select("*").order("created_at");
    const { data } = isTutor && profile ? await query.eq("tutor_id", profile.id) : await query;
    const rows = (data ?? []) as LessonPlan[];
    setPlans(rows);
    setSelectedPlanId((prev) => prev || rows[0]?.id || "");
    setLoading(false);
  }, [profile, isTutor]);

  const loadClasses = useCallback(async () => {
    if (!profile || !isTutor) return;
    const [{ data: classRows }, { data: assignRows }] = await Promise.all([
      supabase.from("classes").select("*").eq("tutor_id", profile.id),
      supabase.from("class_lesson_plans").select("class_id, lesson_plan_id"),
    ]);
    setClasses((classRows ?? []) as ClassRow[]);
    const map: Record<string, string> = {};
    ((assignRows ?? []) as ClassLessonPlan[]).forEach((a) => {
      map[a.class_id] = a.lesson_plan_id;
    });
    setClassPlanByClassId(map);
  }, [profile, isTutor]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPlans();
    loadClasses();
  }, [loadPlans, loadClasses]);

  const loadItems = useCallback(async () => {
    if (!selectedPlanId) {
      setItems([]);
      return;
    }
    const { data } = await supabase
      .from("lesson_plan_items")
      .select("*")
      .eq("lesson_plan_id", selectedPlanId)
      .order("sequence");
    setItems((data ?? []) as LessonPlanItem[]);

    const assignedIds = Object.entries(classPlanByClassId)
      .filter(([, planId]) => planId === selectedPlanId)
      .map(([classId]) => classId);
    setAssignedClasses(classes.filter((c) => assignedIds.includes(c.id)));
  }, [selectedPlanId, classPlanByClassId, classes]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadItems();
  }, [loadItems]);

  async function assignClass(classId: string) {
    if (!selectedPlanId) return;
    const existingPlanId = classPlanByClassId[classId];
    if (existingPlanId === selectedPlanId) return;
    if (existingPlanId) {
      await supabase.from("class_lesson_plans").delete().eq("class_id", classId);
    }
    const { error } = await supabase
      .from("class_lesson_plans")
      .insert({ class_id: classId, lesson_plan_id: selectedPlanId });
    if (error) {
      showToast(error.message);
      return;
    }

    // Give every already-enrolled student a starting-point progress row so
    // they show up as "not started at Lesson 1" rather than having no record.
    const firstItem = items.slice().sort((a, b) => a.sequence - b.sequence)[0];
    if (firstItem) {
      const { data: memberRows } = await supabase.from("class_members").select("*").eq("class_id", classId);
      for (const m of (memberRows ?? []) as ClassMember[]) {
        await supabase.from("student_lesson_progress").upsert(
          {
            student_id: m.student_id,
            lesson_plan_id: selectedPlanId,
            current_item_id: firstItem.id,
            status: "not_started",
          },
          { onConflict: "student_id,lesson_plan_id", ignoreDuplicates: true }
        );
      }
    }

    showToast("Class assigned to this plan");
    loadClasses();
  }

  async function unassignClass(classId: string) {
    await supabase.from("class_lesson_plans").delete().eq("class_id", classId).eq("lesson_plan_id", selectedPlanId);
    loadClasses();
  }

  async function toggleActive(item: LessonPlanItem) {
    const { error } = await supabase.from("lesson_plan_items").update({ active: !item.active }).eq("id", item.id);
    if (error) showToast(error.message);
    else loadItems();
  }

  async function moveItem(item: LessonPlanItem, direction: -1 | 1) {
    const sorted = items.slice().sort((a, b) => a.sequence - b.sequence);
    const idx = sorted.findIndex((i) => i.id === item.id);
    const swapWith = sorted[idx + direction];
    if (!swapWith) return;
    await Promise.all([
      supabase.from("lesson_plan_items").update({ sequence: swapWith.sequence }).eq("id", item.id),
      supabase.from("lesson_plan_items").update({ sequence: item.sequence }).eq("id", swapWith.id),
    ]);
    loadItems();
  }

  async function openMaterial(item: LessonPlanItem) {
    if (!item.material_storage_path) return;
    const { url, error } = await getSignedMaterialUrl(item.material_storage_path);
    if (error || !url) {
      showToast(error?.message ?? "Could not open material");
      return;
    }
    setMaterialModal({ url, page: item.material_page_start ?? 1 });
  }

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const sortedItems = items.slice().sort((a, b) => a.sequence - b.sequence);
  const unassignedClasses = classes.filter((c) => classPlanByClassId[c.id] !== selectedPlanId);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Eyebrow>Lessons</Eyebrow>
        <h1 className="text-2xl font-semibold">Your lesson library</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Define the curriculum here — sequence, objective, and material. Scheduling a class/session with a student
          happens in Schedule.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : plans.length === 0 ? (
        isTutor ? (
          <Card>
            <SectionHead title="No lesson plans yet" subtitle="Create your first curriculum to get started." />
            <LessonPlanPicker
              plans={plans}
              selectedId={selectedPlanId}
              onSelect={setSelectedPlanId}
              tutorId={profile!.id}
              onCreated={(id) => {
                setSelectedPlanId(id);
                loadPlans();
              }}
            />
          </Card>
        ) : (
          <Card>
            <EmptyState icon="📖">No lesson plan assigned yet — check back once your tutor sets one up.</EmptyState>
          </Card>
        )
      ) : (
        <>
          {isTutor ? (
            <LessonPlanPicker
              plans={plans}
              selectedId={selectedPlanId}
              onSelect={setSelectedPlanId}
              tutorId={profile!.id}
              onCreated={(id) => {
                setSelectedPlanId(id);
                loadPlans();
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {plans.map((p) => (
                <Badge key={p.id} tone={p.id === selectedPlanId ? "teal" : "muted"}>
                  {p.name}
                </Badge>
              ))}
            </div>
          )}

          <Card>
            <SectionHead
              eyebrow="Curriculum"
              title={selectedPlan?.name ?? ""}
              subtitle={selectedPlan?.description ?? undefined}
              action={
                isTutor && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                      Preview sequence
                    </Button>
                    <Button size="sm" onClick={() => setItemModal({ item: null })}>
                      ＋ Add Lesson
                    </Button>
                  </div>
                )
              }
            />
            {isTutor && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-m)] bg-paper-alt p-3 text-sm">
                <span className="font-semibold text-ink-soft">Used by:</span>
                {assignedClasses.length === 0 ? (
                  <span className="text-muted">No classes yet</span>
                ) : (
                  assignedClasses.map((c) => (
                    <span key={c.id} className="inline-flex items-center gap-1">
                      <Badge tone="teal">{c.name}</Badge>
                      <button
                        onClick={() => unassignClass(c.id)}
                        aria-label={`Unassign ${c.name}`}
                        className="text-muted hover:text-danger"
                      >
                        ✕
                      </button>
                    </span>
                  ))
                )}
                {unassignedClasses.length > 0 && (
                  <Select
                    className="!w-auto ml-auto py-1 text-xs"
                    value=""
                    onChange={(e) => e.target.value && assignClass(e.target.value)}
                  >
                    <option value="">＋ Assign a class…</option>
                    {unassignedClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {classPlanByClassId[c.id] ? " (reassign)" : ""}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            )}

            {sortedItems.length === 0 ? (
              <EmptyState icon="📖">No lessons in this plan yet.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-muted">
                    <tr>
                      <th className="py-2 pr-3 text-xs font-bold uppercase tracking-wide">#</th>
                      <th className="py-2 pr-3 text-xs font-bold uppercase tracking-wide">Lesson</th>
                      <th className="py-2 pr-3 text-xs font-bold uppercase tracking-wide">Objective</th>
                      <th className="py-2 pr-3 text-xs font-bold uppercase tracking-wide">Material</th>
                      <th className="py-2 pr-3 text-xs font-bold uppercase tracking-wide">Status</th>
                      {isTutor && <th className="py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map((item, idx) => (
                      <tr key={item.id} className="border-t border-line align-top">
                        <td className="py-2.5 pr-3 text-ink-soft">{item.sequence}</td>
                        <td className="py-2.5 pr-3 font-semibold">{item.title}</td>
                        <td className="max-w-[320px] py-2.5 pr-3 text-ink-soft">{item.objective ?? "—"}</td>
                        <td className="py-2.5 pr-3">
                          {item.material_storage_path ? (
                            <button onClick={() => openMaterial(item)} className="font-semibold text-primary hover:underline">
                              View
                              {item.material_page_start && ` (p.${item.material_page_start}${item.material_page_end && item.material_page_end !== item.material_page_start ? `–${item.material_page_end}` : ""})`}
                            </button>
                          ) : item.quran_surah_key ? (
                            <span className="text-ink-soft">Qur&apos;an: {item.quran_surah_key}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          <Badge tone={item.active ? "teal" : "muted"}>{item.active ? "Active" : "Inactive"}</Badge>
                        </td>
                        {isTutor && (
                          <td className="py-2.5 text-right">
                            <div className="flex justify-end gap-2 whitespace-nowrap text-xs font-semibold">
                              <button
                                onClick={() => moveItem(item, -1)}
                                disabled={idx === 0}
                                className="text-ink-soft hover:text-primary disabled:opacity-30"
                                aria-label="Move up"
                              >
                                ↑
                              </button>
                              <button
                                onClick={() => moveItem(item, 1)}
                                disabled={idx === sortedItems.length - 1}
                                className="text-ink-soft hover:text-primary disabled:opacity-30"
                                aria-label="Move down"
                              >
                                ↓
                              </button>
                              <button onClick={() => setItemModal({ item })} className="text-primary hover:underline">
                                Edit
                              </button>
                              <button onClick={() => toggleActive(item)} className="text-ink-soft hover:underline">
                                {item.active ? "Deactivate" : "Activate"}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      <Modal open={!!itemModal} onClose={() => setItemModal(null)}>
        {itemModal && profile && (
          <LessonPlanItemForm
            tutorId={profile.id}
            lessonPlanId={selectedPlanId}
            item={itemModal.item}
            nextSequence={(sortedItems[sortedItems.length - 1]?.sequence ?? 0) + 1}
            prerequisiteItemId={sortedItems[sortedItems.length - 1]?.id ?? null}
            onSaved={() => {
              setItemModal(null);
              loadItems();
            }}
            onCancel={() => setItemModal(null)}
          />
        )}
      </Modal>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} wide>
        <h3 className="mb-3 text-base font-semibold">{selectedPlan?.name} — Full Sequence</h3>
        <ol className="flex flex-col gap-2 text-sm">
          {sortedItems.map((item) => (
            <li key={item.id} className={`rounded-[10px] border border-line p-2.5 ${!item.active ? "opacity-50" : ""}`}>
              <b>
                {item.sequence}. {item.title}
              </b>
              {item.objective && <p className="mt-0.5 text-ink-soft">{item.objective}</p>}
            </li>
          ))}
        </ol>
      </Modal>

      <Modal open={!!materialModal} onClose={() => setMaterialModal(null)} wide>
        {materialModal && <PdfViewer url={materialModal.url} initialPage={materialModal.page} />}
      </Modal>
    </div>
  );
}
