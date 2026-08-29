// Tutor teaching screen (docs/architecture.md §18 — 3-column layout:
// page thumbnails | PDF + highlight tool | students/Meet/highlight controls).
// Implemented in the Highlighting + Realtime phase.
export default async function TeachLessonPage(
  props: PageProps<"/teach/[lessonId]">
) {
  const { lessonId } = await props.params;

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl font-semibold">Teach lesson {lessonId}</h1>
      <p className="mt-2 text-sm text-neutral-500">
        PDF viewer + live highlight controls — implemented in the Highlighting +
        Realtime phase (docs/architecture.md §7, §18, Phase 3).
      </p>
    </main>
  );
}
