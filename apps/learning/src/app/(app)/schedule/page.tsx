"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import type { AppUser, Lesson, LessonStatus, RecurringSessionRule } from "@/lib/types";
import { getBulkCurrentLessonItems, type CurrentLessonInfo } from "@/lib/curriculum";
import { generateSessionsForRule } from "@/lib/recurringSessions";
import { formatTime, computeEndTime, todayISO } from "@/lib/format";
import { Card, Eyebrow, SectionHead } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScheduleSessionForm } from "@/components/lessons/ScheduleSessionForm";
import { isAdminRole } from "@/lib/roles";
import { useLessonMaterialViewer } from "@/components/students/LessonMaterialViewer";
import { useToast } from "@/components/ui/Toast";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STATUS_TONE: Record<LessonStatus, BadgeTone> = {
  scheduled: "teal",
  active: "green",
  completed: "muted",
  cancelled: "red",
};

function weekDates(): string[] {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export default function SchedulePage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const isTutor = profile?.role === "tutor";
  const canManage = isTutor || isAdminRole(profile?.role);
  const { openItem, modal: materialModal } = useLessonMaterialViewer();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [rules, setRules] = useState<RecurringSessionRule[]>([]);
  const [studentsById, setStudentsById] = useState<Map<string, AppUser>>(new Map());
  const [currentLessons, setCurrentLessons] = useState<Map<string, CurrentLessonInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [generatingRuleId, setGeneratingRuleId] = useState<string | null>(null);

  const dates = weekDates();
  const today = todayISO();

  const load = useCallback(async () => {
    const rulesQuery = supabase.from("recurring_session_rules").select("*").eq("active", true);
    const [{ data: lessonRows }, { data: ruleRows }] = await Promise.all([
      supabase.from("lessons").select("*").gte("lesson_date", dates[0]).lte("lesson_date", dates[6]),
      isTutor ? rulesQuery.eq("tutor_id", profile?.id ?? "") : rulesQuery,
    ]);
    const rows = (lessonRows ?? []) as Lesson[];
    const ruleList = (ruleRows ?? []) as RecurringSessionRule[];
    setLessons(rows);
    setRules(ruleList);

    const studentIds = Array.from(new Set([...rows.map((l) => l.student_id), ...ruleList.map((r) => r.student_id)]));
    if (studentIds.length > 0) {
      const [{ data: userRows }, currentMap] = await Promise.all([
        supabase.from("users").select("*").in("id", studentIds),
        getBulkCurrentLessonItems(studentIds),
      ]);
      setStudentsById(new Map(((userRows ?? []) as AppUser[]).map((u) => [u.id, u])));
      setCurrentLessons(currentMap);
    } else {
      setStudentsById(new Map());
      setCurrentLessons(new Map());
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTutor, profile?.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleGenerateMore(rule: RecurringSessionRule) {
    setGeneratingRuleId(rule.id);
    const { created, error } = await generateSessionsForRule(rule);
    setGeneratingRuleId(null);
    if (error) {
      showToast(error.message);
      return;
    }
    showToast(created > 0 ? `${created} more session${created === 1 ? "" : "s"} scheduled` : "Already up to date");
    load();
  }

  async function toggleRuleActive(rule: RecurringSessionRule) {
    const { error } = await supabase.from("recurring_session_rules").update({ active: !rule.active }).eq("id", rule.id);
    if (error) showToast(error.message);
    else load();
  }

  function studentName(id: string) {
    return studentsById.get(id)?.full_name ?? "—";
  }

  function currentLessonLabel(studentId: string) {
    const info = currentLessons.get(studentId);
    if (!info) return null;
    return info.item ? `${info.plan.name} — Lesson ${info.item.sequence}: ${info.item.title}` : `${info.plan.name} — plan completed 🎉`;
  }

  const todaysSessions = lessons
    .filter((l) => l.lesson_date === today)
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Eyebrow>This week</Eyebrow>
          <h1 className="text-2xl font-semibold">Schedule</h1>
        </div>
        {canManage && <Button onClick={() => setModalDate(dates[0])}>+ Schedule Session</Button>}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          <Card>
            <SectionHead title="Today's Sessions" subtitle="Each session is a one-to-one Tutor ↔ Student slot." />
            {todaysSessions.length === 0 ? (
              <EmptyState icon="🗓️">No sessions scheduled for today.</EmptyState>
            ) : (
              <div className="flex flex-col gap-2.5">
                {todaysSessions.map((l) => {
                  const info = currentLessons.get(l.student_id);
                  return (
                    <div
                      key={l.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-m)] border border-line p-3.5"
                    >
                      <div>
                        <b className="text-sm">
                          {formatTime(l.start_time) ?? "—"}
                          {l.start_time && ` – ${computeEndTime(l.start_time, l.duration_minutes)}`}
                        </b>
                        <div className="text-sm font-semibold text-ink-soft">{studentName(l.student_id)}</div>
                        <div className="text-xs text-muted">{currentLessonLabel(l.student_id) ?? "No curriculum assigned yet"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={STATUS_TONE[l.status]}>{l.status}</Badge>
                        <Button size="sm" variant="outline" disabled={!info?.item} onClick={() => info?.item && openItem(info.item)}>
                          ▶ Launch Lesson
                        </Button>
                        <Link
                          href={`/teach/${l.id}`}
                          className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-deep"
                        >
                          Start Session
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
              {dates.map((date, i) => {
                const dayLessons = lessons
                  .filter((l) => l.lesson_date === date)
                  .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
                const isToday = date === today;
                return (
                  <div key={date} className={`min-h-[180px] rounded-[var(--radius-m)] p-2.5 ${isToday ? "bg-primary-tint" : "bg-paper-alt"}`}>
                    <b className="mb-2 block text-[0.78rem] text-ink-soft">
                      {DAY_LABELS[i]} <span className="text-muted">{date.slice(5)}</span>
                    </b>
                    {dayLessons.map((l) => (
                      <Link
                        key={l.id}
                        href={`/teach/${l.id}`}
                        className="mb-1.5 block rounded-[8px] border border-l-[3px] border-line border-l-primary bg-surface p-2 text-[0.7rem]"
                      >
                        <b className="block text-[0.72rem]">{formatTime(l.start_time) ?? "—"}</b>
                        <span className="text-ink-soft">{studentName(l.student_id)}</span>
                      </Link>
                    ))}
                    {canManage && (
                      <button
                        onClick={() => setModalDate(date)}
                        className="w-full rounded-[8px] border border-dashed border-line py-1.5 text-center text-[0.68rem] text-muted hover:border-primary hover:text-primary"
                      >
                        + Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {canManage && rules.length > 0 && (
            <Card>
              <SectionHead title="Recurring Sessions" subtitle="Each rule generates individual sessions ahead of time — nothing runs on a live schedule in the background." />
              <div className="flex flex-col gap-2.5">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-m)] border border-line p-3.5"
                  >
                    <div>
                      <b className="text-sm">{studentName(rule.student_id)}</b>
                      <div className="text-xs text-muted">
                        {rule.days_of_week.map((d) => DAY_LABELS[d]).join(", ")} · {formatTime(rule.start_time)} ·{" "}
                        {rule.duration_minutes} min
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleGenerateMore(rule)} disabled={generatingRuleId === rule.id}>
                        {generatingRuleId === rule.id ? "Generating…" : "Generate 8 more weeks"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleRuleActive(rule)}>
                        Pause
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <Modal open={!!modalDate} onClose={() => setModalDate(null)}>
        <h3 className="mb-3 text-base font-semibold">Schedule Session</h3>
        <ScheduleSessionForm
          defaultDate={modalDate ?? undefined}
          onCreated={() => {
            setModalDate(null);
            load();
          }}
        />
      </Modal>
      {materialModal}
    </div>
  );
}
