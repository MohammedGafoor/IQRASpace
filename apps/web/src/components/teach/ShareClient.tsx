"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import { getLessonChannel, type HighlightState } from "@/lib/realtime";
import { getLatestHighlight } from "@/lib/sharing";
import { getSurah, type SurahContent } from "@/lib/quranContent";
import { getLessonMaterial, getSignedMaterialUrl } from "@/lib/storage";
import type { Lesson, LessonPlanItem, Meeting } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PdfViewer } from "@/components/pdf/PdfViewer";

function ayahNumberFromText(surah: SurahContent, text: string): number | null {
  return surah.ayahs.find((a) => a.arabic === text)?.number ?? null;
}

type SharedState = { page: number; ayah: number | null; active: boolean };

export function ShareClient({ lessonId }: { lessonId: string }) {
  const { profile, session, loading: authLoading } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [materialUrl, setMaterialUrl] = useState<string | null>(null);
  const [planItem, setPlanItem] = useState<LessonPlanItem | null>(null);
  const [connected, setConnected] = useState(false);
  const [shared, setShared] = useState<SharedState>({ page: 1, ayah: null, active: false });
  const channelRef = useRef<ReturnType<typeof getLessonChannel> | null>(null);

  const surah = getSurah(lesson?.quran_surah_key ?? planItem?.quran_surah_key ?? undefined);

  useEffect(() => {
    async function load() {
      const { data: lessonRow } = await supabase.from("lessons").select("*").eq("id", lessonId).single();
      const loadedLesson = (lessonRow as Lesson) ?? null;
      setLesson(loadedLesson);
      const { data: meetingRow } = await supabase.from("meetings").select("*").eq("lesson_id", lessonId).maybeSingle();
      setMeeting((meetingRow as Meeting) ?? null);

      let loadedPlanItem: LessonPlanItem | null = null;
      if (loadedLesson?.lesson_plan_item_id) {
        const { data: itemRow } = await supabase
          .from("lesson_plan_items")
          .select("*")
          .eq("id", loadedLesson.lesson_plan_item_id)
          .maybeSingle();
        loadedPlanItem = (itemRow as LessonPlanItem) ?? null;
        setPlanItem(loadedPlanItem);
      }

      const loadedSurah = getSurah(loadedLesson?.quran_surah_key ?? loadedPlanItem?.quran_surah_key ?? undefined);
      if (!loadedSurah && loadedLesson) {
        const mat = await getLessonMaterial(lessonId);
        if (mat?.storage_path) {
          const { url } = await getSignedMaterialUrl(mat.storage_path);
          setMaterialUrl(url);
        } else if (loadedPlanItem?.material_storage_path) {
          const { url } = await getSignedMaterialUrl(loadedPlanItem.material_storage_path);
          setMaterialUrl(url);
        }
      }

      // Realtime broadcast has no replay — catch up on whatever the tutor
      // last shared in case they were already sharing before this page loaded.
      const latest = await getLatestHighlight(lessonId);
      if (latest) {
        setShared({
          page: latest.pageNumber,
          ayah: loadedSurah ? ayahNumberFromText(loadedSurah, latest.selectedText) : null,
          active: true,
        });
      }
    }
    load();
  }, [lessonId]);

  useEffect(() => {
    if (!profile) return;
    const channel = getLessonChannel(lessonId);
    channelRef.current = channel;

    channel.on("broadcast", { event: "highlight" }, ({ payload }: { payload: Partial<HighlightState> }) => {
      if (payload.sessionStatus === "ended") {
        setShared({ page: 1, ayah: null, active: false });
        return;
      }
      setShared({
        page: payload.pageNumber ?? 1,
        ayah: payload.highlightType === "ayah" && payload.selectedText ? Number(payload.selectedText) : null,
        active: true,
      });
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setConnected(true);
        await channel.track({ userId: profile.id, role: "student" });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lessonId, profile]);

  if (authLoading) return <p className="p-8 text-sm text-muted">Loading…</p>;

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted">Log in as the student in this lesson to follow along live.</p>
        <Link href="/login" className="font-semibold text-primary underline">
          Log in
        </Link>
      </div>
    );
  }

  if (!lesson) return <p className="p-8 text-sm text-muted">Loading…</p>;

  const ayahsOnPage = surah?.ayahs.filter((a) => a.page === shared.page) ?? [];
  const hasContent = !!surah || !!materialUrl;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div>
          <b className="font-display text-lg">{lesson.title}</b>
          {lesson.start_time && <span className="ml-2 text-sm text-muted">{lesson.lesson_date}</span>}
        </div>
        {meeting && (
          <a href={meeting.meet_url} target="_blank" rel="noreferrer">
            <Button>🎥 Join Google Meet</Button>
          </a>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-10">
        {!hasContent ? (
          <p className="text-center text-sm text-muted">This lesson has no teaching content attached yet.</p>
        ) : !shared.active ? (
          <div className="rounded-[var(--radius-l)] border border-line bg-surface p-10 text-center">
            <span className="mb-2 block text-2xl">🕊️</span>
            <p className="text-sm text-muted">Waiting for the Tutor to share a passage…</p>
          </div>
        ) : surah ? (
          <div className="rounded-[var(--radius-l)] border border-line bg-surface p-6">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-success-tint px-2.5 py-1 text-xs font-bold text-success">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Tutor is explaining this section
            </span>
            {ayahsOnPage.map((a) => (
              <div
                key={a.number}
                className={`mb-3 flex items-center gap-3 rounded-xl border p-4 ${
                  shared.ayah === a.number ? "border-accent bg-accent-tint" : "border-line"
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-tint text-xs font-bold text-primary-deep">
                  {a.number}
                </div>
                <div className="font-arabic flex-1 text-right text-3xl leading-[2.2]">{a.arabic}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--radius-l)] border border-line bg-surface p-4">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-success-tint px-2.5 py-1 text-xs font-bold text-success">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Following the Tutor live
            </span>
            <PdfViewer url={materialUrl} page={shared.page} readOnly />
          </div>
        )}
      </main>

      <footer className="flex items-center justify-between border-t border-line px-6 py-3 text-xs text-muted">
        <span>
          Status: <Badge tone={connected ? "green" : "muted"}>{connected ? "connected" : "connecting…"}</Badge>
        </span>
        {surah && (
          <span>
            Page {shared.page} of {Math.max(...surah.ayahs.map((a) => a.page))}
          </span>
        )}
      </footer>
    </div>
  );
}
