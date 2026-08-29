import { TeachClient } from "@/components/teach/TeachClient";

// Tutor teaching screen (architecture §18 — 3-column layout: page
// thumbnails | Qur'an content + highlight tool | students/Meet/highlight
// controls). Kept as a server component only to unwrap the async `params`
// Next 16 requires — all the interactive/realtime work lives in TeachClient.
export default async function TeachLessonPage(props: PageProps<"/teach/[lessonId]">) {
  const { lessonId } = await props.params;
  return <TeachClient lessonId={lessonId} />;
}
