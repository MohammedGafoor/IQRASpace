// Student sharing view (docs/architecture.md §18 — simplified, single focus,
// read-only follow of the tutor's current page/highlight).
// Implemented in the Highlighting + Realtime phase.
export default async function ShareLessonPage(
  props: PageProps<"/share/[lessonId]">
) {
  const { lessonId } = await props.params;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Lesson {lessonId}</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Live read-only highlight view — implemented in the Highlighting + Realtime
        phase (docs/architecture.md §7, §18, Phase 3).
      </p>
    </main>
  );
}
