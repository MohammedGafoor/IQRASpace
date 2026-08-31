"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import {
  deleteLessonMaterial,
  formatFileSize,
  getSignedMaterialUrl,
  listAllLessonMaterials,
  listLessonMaterials,
  uploadLessonMaterial,
  type StoredFile,
} from "@/lib/storage";
import type { AppUser, Lesson } from "@/lib/types";
import { buildGoogleDriveConsentUrl } from "@/lib/googleDrive";
import { isAdminRole } from "@/lib/roles";
import { useToast } from "@/components/ui/Toast";
import { Card, Eyebrow } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Tabs } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { PdfViewer } from "@/components/pdf/PdfViewer";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function MaterialsPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const isTutor = profile?.role === "tutor";
  // Admin/super_admin can manage every tutor's materials, not just their own
  // (0018_admin_full_access.sql for the write side; storage read/list is
  // already open to any authenticated user per 0011).
  const canManage = isTutor || isAdminRole(profile?.role);

  const [tab, setTab] = useState<"mine" | "drive">("mine");
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [studentsById, setStudentsById] = useState<Map<string, AppUser>>(new Map());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null);
  const [attachTarget, setAttachTarget] = useState<StoredFile | null>(null);
  const [attachLessonId, setAttachLessonId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const [stored, { data: lessonRows }] = await Promise.all([
      canManage && !isTutor ? listAllLessonMaterials() : listLessonMaterials(profile.id),
      supabase.from("lessons").select("*").order("lesson_date", { ascending: false }),
    ]);
    setFiles(stored);
    const lessonList = (lessonRows ?? []) as Lesson[];
    setLessons(lessonList);
    const studentIds = Array.from(new Set(lessonList.map((l) => l.student_id)));
    if (studentIds.length > 0) {
      const { data: userRows } = await supabase.from("users").select("*").in("id", studentIds);
      setStudentsById(new Map(((userRows ?? []) as AppUser[]).map((u) => [u.id, u])));
    }
    setLoading(false);
  }, [profile, isTutor, canManage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    const { error } = await uploadLessonMaterial(profile.id, file);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (error) {
      showToast(`Upload failed: ${error.message}`);
      return;
    }
    showToast("File uploaded");
    load();
  }

  async function handlePreview(f: StoredFile) {
    const { url, error } = await getSignedMaterialUrl(f.path);
    if (error || !url) {
      showToast("Couldn't open this file");
      return;
    }
    setPreview({ name: f.name, url });
  }

  async function handleDelete(f: StoredFile) {
    if (!confirm(`Delete ${f.name}? Any lessons using it will lose the attachment.`)) return;
    await deleteLessonMaterial(f.path);
    showToast("File deleted");
    load();
  }

  async function handleAttach() {
    if (!attachTarget || !attachLessonId) return;
    const { error } = await supabase.from("lesson_materials").insert({
      lesson_id: attachLessonId,
      storage_path: attachTarget.path,
      material_type: "pdf",
    });
    if (error) {
      showToast(`Couldn't attach: ${error.message}`);
      return;
    }
    showToast("Added to lesson");
    setAttachTarget(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Eyebrow>Lesson Materials</Eyebrow>
        <h1 className="text-2xl font-semibold">Your files, ready to attach to a lesson</h1>
      </div>

      <Tabs
        tabs={[
          { value: "mine", label: "My Lesson Files" },
          { value: "drive", label: "Google Drive" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "mine" && (
        <div className="flex flex-col gap-4">
          {canManage && (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">Upload a lesson PDF</h3>
                  <p className="text-sm text-muted">Stored directly in your workspace — no Drive connection needed.</p>
                </div>
                <label>
                  <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
                  <Button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? "Uploading…" : "+ Upload PDF"}
                  </Button>
                </label>
              </div>
            </Card>
          )}

          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : files.length === 0 ? (
            <Card>
              <EmptyState icon="📄">No files uploaded yet.</EmptyState>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {files.map((f) => (
                <Card key={f.path} className="flex items-center gap-3">
                  <span className="text-2xl">📄</span>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-sm">{f.name}</b>
                    <span className="text-xs text-muted">{formatFileSize(f.size)}</span>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => handlePreview(f)}>
                      View
                    </Button>
                    {canManage && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setAttachTarget(f)}>
                          Add
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleDelete(f)}>
                          ✕
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "drive" && (
        <Card>
          <h3 className="mb-2 text-base font-semibold">📁 Connect Google Drive</h3>
          {GOOGLE_CLIENT_ID ? (
            <>
              <p className="mb-3 text-sm text-ink-soft">
                Use lesson PDFs you&rsquo;ve already saved in Drive — IQRASpace only ever sees the specific files you
                choose to share.
              </p>
              <Button onClick={() => profile && (window.location.href = buildGoogleDriveConsentUrl(profile.id))}>
                Connect Google Drive
              </Button>
            </>
          ) : (
            <div className="rounded-[var(--radius-m)] bg-warning-tint p-4 text-sm text-ink-soft">
              <Badge tone="amber">Not configured</Badge>
              <p className="mt-2">
                Google Drive integration needs a Google Cloud OAuth client, which only your administrator can
                provision (architecture §8). Once <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> is set, this tab
                activates automatically. Until then, direct PDF upload above covers lesson materials.
              </p>
            </div>
          )}
        </Card>
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} wide>
        {preview && (
          <>
            <h3 className="mb-3 text-base font-semibold">{preview.name}</h3>
            <PdfViewer url={preview.url} />
          </>
        )}
      </Modal>

      <Modal open={!!attachTarget} onClose={() => setAttachTarget(null)}>
        <h3 className="mb-3 text-base font-semibold">Add to a lesson</h3>
        <Select value={attachLessonId} onChange={(e) => setAttachLessonId(e.target.value)} className="mb-4">
          <option value="">Choose a lesson…</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {studentsById.get(l.student_id)?.full_name ?? l.title} — {l.lesson_date}
            </option>
          ))}
        </Select>
        <Button onClick={handleAttach} disabled={!attachLessonId} className="w-full">
          Add Selected to Lesson
        </Button>
      </Modal>
    </div>
  );
}
