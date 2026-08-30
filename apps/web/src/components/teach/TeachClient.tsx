"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import { getLessonChannel, type HighlightState } from "@/lib/realtime";
import { getOrCreateActiveSession, recordHighlight } from "@/lib/sharing";
import { getSurah, surahPageCount } from "@/lib/quranContent";
import { getLessonMaterial, getSignedMaterialUrl } from "@/lib/storage";
import type { AppUser, ClassRow, Lesson, LessonMaterial, LessonPlanItem, Meeting } from "@/lib/types";
import { isAdminRole } from "@/lib/roles";
import { Card, Eyebrow } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { ViewToggle } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { PdfViewer } from "@/components/pdf/PdfViewer";
import { ConfirmLessonCompletion } from "@/components/lessons/ConfirmLessonCompletionModal";

type ViewMode = "split" | "tutor" | "student";

export function TeachClient({ lessonId }: { lessonId: string }) {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [className, setClassName] = useState("");
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<AppUser[]>([]);
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());

  // Ayah-mode (bundled Qur'an content) state.
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAyah, setSelectedAyah] = useState<number | null>(null);
  const [highlightedAyah, setHighlightedAyah] = useState<number | null>(null);
  const [mode, setMode] = useState<ViewMode>("split");

  // PDF-mode (attached material, e.g. Qaida – Beginners curriculum) state.
  const [material, setMaterial] = useState<LessonMaterial | null>(null);
  const [materialUrl, setMaterialUrl] = useState<string | null>(null);
  const [pdfPage, setPdfPage] = useState(1);

  // Universal Lesson Plan item this session is teaching, if any — a session
  // can inherit its content (surah/material) from here when the lesson row
  // itself carries no quran_surah_key of its own.
  const [planItem, setPlanItem] = useState<LessonPlanItem | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState("");

  const sessionIdRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<typeof getLessonChannel> | null>(null);

  const surah = getSurah(lesson?.quran_surah_key ?? planItem?.quran_surah_key ?? undefined);
  const isTutor = profile?.role === "tutor";
  const canManage = isTutor || isAdminRole(profile?.role);

  useEffect(() => {
    async function load() {
      const { data: lessonRow } = await supabase.from("lessons").select("*").eq("id", lessonId).single();
      if (!lessonRow) return;
      const loadedLesson = lessonRow as Lesson;
      setLesson(loadedLesson);

      const { data: classRow } = await supabase.from("classes").select("*").eq("id", loadedLesson.class_id).single();
      if (classRow) setClassName((classRow as ClassRow).name);

      const { data: meetingRow } = await supabase.from("meetings").select("*").eq("lesson_id", lessonId).maybeSingle();
      setMeeting((meetingRow as Meeting) ?? null);

      // One-to-one session — `participants` is always this one student
      // (0023_student_based_scheduling.sql's `lessons.student_id`), not the
      // whole class roster.
      const { data: studentRow } = await supabase.from("users").select("*").eq("id", loadedLesson.student_id).maybeSingle();
      if (studentRow) setParticipants([studentRow as AppUser]);

      let loadedPlanItem: LessonPlanItem | null = null;
      if (loadedLesson.lesson_plan_item_id) {
        const { data: itemRow } = await supabase
          .from("lesson_plan_items")
          .select("*")
          .eq("id", loadedLesson.lesson_plan_item_id)
          .maybeSingle();
        loadedPlanItem = (itemRow as LessonPlanItem) ?? null;
        setPlanItem(loadedPlanItem);
      }

      const effectiveSurahKey = loadedLesson.quran_surah_key || loadedPlanItem?.quran_surah_key || null;
      if (!effectiveSurahKey) {
        // Prefer a material manually attached to this session (Materials
        // page); fall back to the linked plan item's own material — the
        // curriculum's source of truth when no per-session override exists.
        const mat = await getLessonMaterial(lessonId);
        if (mat?.storage_path) {
          setMaterial(mat);
          setPdfPage(mat.page_start ?? 1);
          const { url } = await getSignedMaterialUrl(mat.storage_path);
          setMaterialUrl(url);
        } else if (loadedPlanItem?.material_storage_path) {
          setMaterial({
            id: loadedPlanItem.id,
            lesson_id: lessonId,
            drive_file_id: null,
            storage_path: loadedPlanItem.material_storage_path,
            material_type: loadedPlanItem.material_type ?? "pdf",
            page_start: loadedPlanItem.material_page_start,
            page_end: loadedPlanItem.material_page_end,
          });
          setPdfPage(loadedPlanItem.material_page_start ?? 1);
          const { url } = await getSignedMaterialUrl(loadedPlanItem.material_storage_path);
          setMaterialUrl(url);
        }
      }
    }
    load();
  }, [lessonId]);

  useEffect(() => {
    if (!profile) return;
    const channel = getLessonChannel(lessonId);
    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ userId: string; role: string }>();
      const ids = new Set<string>();
      Object.values(state).forEach((presences) =>
        presences.forEach((p) => {
          if (p.role === "student") ids.add(p.userId);
        })
      );
      setPresentIds(ids);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ userId: profile.id, role: profile.role });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lessonId, profile]);

  if (!lesson) return <p className="text-sm text-muted">Loading…</p>;

  const confirmModal = planItem && profile && (
    <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
      <ConfirmLessonCompletion
        lessonId={lessonId}
        planItem={planItem}
        tutorId={profile.id}
        participants={participants}
        onConfirmed={() => {
          setConfirmOpen(false);
          showToast("Progress updated for confirmed students");
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </Modal>
  );

  function broadcastEnded() {
    channelRef.current?.send({
      type: "broadcast",
      event: "highlight",
      payload: { sessionStatus: "ended" } satisfies Partial<HighlightState>,
    });
  }

  async function openMeet() {
    if (!meeting) {
      showToast("No Meet link yet — add one from Lessons.");
      return;
    }
    window.open(meeting.meet_url, "_blank");
  }

  async function saveNote() {
    if (!note.trim()) return;
    await supabase.from("lesson_notes").insert({ lesson_id: lessonId, note });
    setNote("");
    showToast("Note saved to this lesson");
  }

  // ============ PDF mode (attached material — e.g. Qaida curriculum) ============
  if (!surah) {
    if (!material || !materialUrl) {
      return (
        <Card>
          <Eyebrow>{className}</Eyebrow>
          <h2 className="text-lg font-semibold">{lesson.title}</h2>
          <p className="mt-3 text-sm text-ink-soft">
            This lesson doesn&rsquo;t have any teaching content attached yet — pick a bundled surah for it, or
            attach a PDF from the Materials page, then come back here.
          </p>
        </Card>
      );
    }

    async function sharePdfPage() {
      if (!sessionIdRef.current) {
        sessionIdRef.current = await getOrCreateActiveSession(lessonId);
      }
      if (sessionIdRef.current) {
        await recordHighlight(sessionIdRef.current, {
          pageNumber: pdfPage,
          selectedText: `PDF page ${pdfPage}`,
          kind: "pdf",
        });
      }
      const payload: HighlightState = {
        lessonId,
        materialId: material!.id,
        pageNumber: pdfPage,
        zoomLevel: 1,
        scrollPosition: { x: 0, y: 0 },
        highlightType: "rect",
        coordinates: { x: 0, y: 0, width: 1, height: 1 },
        sessionStatus: "active",
        updatedAt: new Date().toISOString(),
      };
      channelRef.current?.send({ type: "broadcast", event: "highlight", payload });
      setSharing(true);
      showToast("Shared with students — this page appears on their screens instantly");
    }

    function stopPdfSharing() {
      if (sharing) broadcastEnded();
      setSharing(false);
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <b className="font-display text-lg">{lesson.title}</b>
            <div className="text-[0.78rem] text-muted">
              {className}
              {material.page_start && ` · Curriculum pages ${material.page_start}${material.page_end && material.page_end !== material.page_start ? `–${material.page_end}` : ""}`}
            </div>
          </div>
          <Badge tone={sharing ? "green" : "muted"}>{sharing ? "🟢 Sharing live" : "⚪ Not sharing"}</Badge>
        </div>

        <div className="grid grid-cols-[1fr_260px] gap-4 max-lg:grid-cols-1">
          <Card padded={false} className="overflow-hidden">
            <div className="flex items-center justify-between bg-paper-alt px-4 py-3">
              <b className="text-sm">📄 Lesson Material — editable</b>
              <Badge tone="muted">You</Badge>
            </div>
            <div className="p-4">
              <PdfViewer url={materialUrl} page={pdfPage} onPageChange={setPdfPage} />
            </div>
          </Card>

          <div className="flex flex-col gap-3.5">
            <Card>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Highlight Tools</h4>
              <p className="mb-2 text-xs text-ink-soft">
                Navigate to the page you want to teach, then share it — the student&rsquo;s screen follows live.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" size="sm" onClick={stopPdfSharing}>
                  Stop Sharing
                </Button>
              </div>
              <Button onClick={sharePdfPage} className="mt-2.5 w-full">
                📤 Share This Page
              </Button>
            </Card>
            <SideCards
              participants={participants}
              presentIds={presentIds}
              meeting={meeting}
              openMeet={openMeet}
              note={note}
              setNote={setNote}
              saveNote={saveNote}
              canConfirm={canManage && !!planItem}
              onConfirm={() => setConfirmOpen(true)}
            />
          </div>
        </div>
        {confirmModal}
      </div>
    );
  }

  // ============ Ayah mode (bundled Qur'an content) ============
  const pageCount = surahPageCount(surah);
  const ayahsOnPage = surah.ayahs.filter((a) => a.page === currentPage);

  function goPage(p: number) {
    setCurrentPage(p);
    setSelectedAyah(null);
  }

  function applyHighlight() {
    if (!selectedAyah) {
      showToast("Select a verse first");
      return;
    }
    setHighlightedAyah(selectedAyah);
    showToast("Highlighted — ready to share");
  }

  function clearHighlight() {
    setHighlightedAyah(null);
    setSelectedAyah(null);
    if (sharing) broadcastEnded();
    setSharing(false);
  }

  async function shareWithStudent() {
    if (!highlightedAyah || !surah) {
      showToast("Highlight a verse before sharing");
      return;
    }
    const ayah = surah.ayahs.find((a) => a.number === highlightedAyah)!;

    if (!sessionIdRef.current) {
      sessionIdRef.current = await getOrCreateActiveSession(lessonId);
    }
    if (sessionIdRef.current) {
      await recordHighlight(sessionIdRef.current, { pageNumber: currentPage, selectedText: ayah.arabic, kind: "ayah" });
    }

    const payload: HighlightState = {
      lessonId,
      materialId: surah.key,
      pageNumber: currentPage,
      zoomLevel: 1,
      scrollPosition: { x: 0, y: 0 },
      highlightType: "ayah",
      coordinates: { x: 0, y: 0, width: 1, height: 1 },
      selectedText: String(highlightedAyah),
      sessionStatus: "active",
      updatedAt: new Date().toISOString(),
    };
    channelRef.current?.send({ type: "broadcast", event: "highlight", payload });
    setSharing(true);
    showToast("Shared with students — appears on their screens instantly");
  }

  function playDemo() {
    clearHighlight();
    showToast("Demo starting…");
    const secondPage = pageCount > 1 ? 2 : 1;
    const targetAyah = surah!.ayahs.find((a) => a.page === secondPage)?.number ?? surah!.ayahs[0].number;
    setTimeout(() => goPage(secondPage), 400);
    setTimeout(() => setSelectedAyah(targetAyah), 1100);
    setTimeout(() => setHighlightedAyah(targetAyah), 1900);
    setTimeout(() => shareWithStudent(), 2700);
  }

  const showTutorPanel = mode !== "student";
  const showStudentPanel = mode !== "tutor";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-m)] bg-primary-deep px-5 py-3.5 text-white">
        <div>
          <b className="font-display text-base">See it live</b>
          <p className="m-0 text-[0.83rem] text-[#cfe3de]">
            Select a verse, highlight it, and share it — watch the Student panel update instantly.
          </p>
        </div>
        <Button variant="gold" onClick={playDemo}>
          ▶ Demonstrate Live Sharing
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <b className="font-display text-lg">
            {surah.name} — {lesson.title}
          </b>
          <div className="text-[0.78rem] text-muted">
            {className} · Page {currentPage} of {pageCount}
          </div>
        </div>
        <ViewToggle
          options={[
            { value: "split", label: "Split View" },
            { value: "tutor", label: "Tutor View" },
            { value: "student", label: "Student View" },
          ]}
          active={mode}
          onChange={setMode}
        />
        <Badge tone={sharing ? "green" : "muted"}>{sharing ? "🟢 Sharing live" : "⚪ Not sharing"}</Badge>
      </div>

      <div className="grid grid-cols-[110px_1fr_260px] gap-4 max-lg:grid-cols-1">
        <div className="flex gap-2 lg:flex-col">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => goPage(p)}
              className={`flex-1 rounded-[10px] border-2 p-2.5 text-center text-xs font-bold lg:flex-none ${
                p === currentPage ? "border-primary bg-primary-tint text-primary-deep" : "border-line text-muted"
              }`}
            >
              <span className="block font-display text-lg">{p}</span>
              Page {p}
            </button>
          ))}
        </div>

        <div className="order-1 flex flex-wrap gap-4 lg:order-none">
          {showTutorPanel && (
            <div className="min-w-[280px] flex-1 rounded-[var(--radius-l)] border border-line bg-surface shadow-[var(--shadow-s)]">
              <div className="flex items-center justify-between bg-paper-alt px-4 py-3">
                <b className="text-sm">👤 Tutor View — editable</b>
                <Badge tone="muted">You</Badge>
              </div>
              <div className="p-4">
                {ayahsOnPage.map((a) => (
                  <div
                    key={a.number}
                    onClick={() => setSelectedAyah(a.number)}
                    className={`mb-2.5 flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors ${
                      selectedAyah === a.number ? "border-primary shadow-[0_0_0_2px_var(--color-primary-tint)_inset]" : "border-line"
                    } ${highlightedAyah === a.number ? "bg-accent-tint border-accent" : ""}`}
                  >
                    <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-primary-tint text-xs font-bold text-primary-deep">
                      {a.number}
                    </div>
                    <div className="font-arabic flex-1 text-right text-2xl leading-[2.1]">{a.arabic}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {showStudentPanel && (
            <div className="min-w-[280px] flex-1 rounded-[var(--radius-l)] border border-line bg-surface shadow-[var(--shadow-s)]">
              <div className="flex items-center justify-between bg-paper-alt px-4 py-3">
                <b className="text-sm">🎓 Student View — read only</b>
                <Badge tone="muted">Preview</Badge>
              </div>
              <div className="p-4">
                {!sharing ? (
                  <p className="py-10 text-center text-sm text-muted">Waiting for the Tutor to share a passage…</p>
                ) : (
                  <>
                    <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-success-tint px-2.5 py-1 text-xs font-bold text-success">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Tutor is explaining this
                      section
                    </span>
                    {ayahsOnPage.map((a) => (
                      <div
                        key={a.number}
                        className={`mb-2.5 flex items-center gap-3 rounded-xl border p-3.5 ${
                          highlightedAyah === a.number ? "border-accent bg-accent-tint" : "border-line"
                        }`}
                      >
                        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-primary-tint text-xs font-bold text-primary-deep">
                          {a.number}
                        </div>
                        <div className="font-arabic flex-1 text-right text-2xl leading-[2.1]">{a.arabic}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="order-2 flex flex-col gap-3.5 lg:order-none">
          <Card>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Selected Content</h4>
            <div className="font-display text-xl text-primary-deep">
              {selectedAyah ? `Ayah ${selectedAyah}` : "None selected"}
            </div>
          </Card>
          <Card>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Highlight Tools</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={applyHighlight}>
                ✏️ Highlight
              </Button>
              <Button variant="ghost" size="sm" onClick={clearHighlight}>
                Clear
              </Button>
              <Button variant="ghost" size="sm" onClick={() => goPage(Math.max(1, currentPage - 1))}>
                ◀ Prev
              </Button>
              <Button variant="ghost" size="sm" onClick={() => goPage(Math.min(pageCount, currentPage + 1))}>
                Next ▶
              </Button>
            </div>
            <Button onClick={shareWithStudent} className="mt-2.5 w-full">
              📤 Share with Student
            </Button>
          </Card>
          <SideCards
            participants={participants}
            presentIds={presentIds}
            meeting={meeting}
            openMeet={openMeet}
            note={note}
            setNote={setNote}
            saveNote={saveNote}
            canConfirm={canManage && !!planItem}
            onConfirm={() => setConfirmOpen(true)}
          />
        </div>
      </div>
      {confirmModal}
    </div>
  );
}

function SideCards({
  participants,
  presentIds,
  meeting,
  openMeet,
  note,
  setNote,
  saveNote,
  canConfirm,
  onConfirm,
}: {
  participants: AppUser[];
  presentIds: Set<string>;
  meeting: Meeting | null;
  openMeet: () => void;
  note: string;
  setNote: (v: string) => void;
  saveNote: () => void;
  canConfirm?: boolean;
  onConfirm?: () => void;
}): ReactNode {
  return (
    <>
      <Card>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">In this lesson</h4>
        {participants.length === 0 ? (
          <p className="text-sm text-muted">No students yet.</p>
        ) : (
          participants.map((p) => (
            <div key={p.id} className="flex items-center gap-2 py-1.5 text-sm">
              <span>{p.full_name}</span>
              {presentIds.has(p.id) && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-success" />}
            </div>
          ))
        )}
        <Button variant="outline" size="sm" onClick={openMeet} className="mt-2.5 w-full">
          🎥 {meeting ? "Start Google Meet" : "No Meet link yet"}
        </Button>
      </Card>
      {canConfirm && (
        <Card>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Curriculum Progress</h4>
          <p className="mb-2 text-xs text-ink-soft">
            Ending this session never advances a student on its own — confirm here once you&rsquo;re satisfied the
            lesson was actually completed.
          </p>
          <Button variant="gold" size="sm" onClick={onConfirm} className="w-full">
            ✅ Confirm Lesson Completed
          </Button>
        </Card>
      )}
      <Card>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Quick Note</h4>
        <Textarea
          placeholder="Jot something down during the lesson…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-[60px]"
        />
        <Button variant="ghost" size="sm" onClick={saveNote} className="mt-2">
          Save Note
        </Button>
      </Card>
    </>
  );
}
