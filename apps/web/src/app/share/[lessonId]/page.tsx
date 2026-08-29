import { ShareClient } from "@/components/teach/ShareClient";

// Student sharing view (architecture §18 — simplified, single focus,
// read-only follow of the tutor's current highlight). Deliberately outside
// the (app) route group's sidebar/topbar shell — a student joining a live
// lesson gets minimal chrome, not the full tutor workspace.
export default async function ShareLessonPage(props: PageProps<"/share/[lessonId]">) {
  const { lessonId } = await props.params;
  return <ShareClient lessonId={lessonId} />;
}
