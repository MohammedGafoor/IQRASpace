import { supabase } from "./supabaseClient";
import type { AppNotification, NotificationType } from "./types";

/**
 * Thin wrapper around the notify_user() RPC (supabase/migrations/0009_notifications.sql).
 * Client code never inserts into `notifications` directly — the RPC checks the
 * caller is either notifying themself or one of their own students.
 */
export async function notifyUser(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  relatedLessonId?: string;
}) {
  const { error } = await supabase.rpc("notify_user", {
    p_user_id: params.userId,
    p_type: params.type,
    p_title: params.title,
    p_body: params.body ?? null,
    p_related_lesson_id: params.relatedLessonId ?? null,
  });
  // Notifications are a nice-to-have side effect of the real action (scheduling
  // a lesson, marking attendance, ...) — never let a notify failure surface as
  // if the primary action failed.
  if (error) console.warn("notifyUser failed:", error.message);
}

export async function fetchNotifications(userId: string, limit = 20): Promise<AppNotification[]> {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function markAllNotificationsRead(userId: string) {
  await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
}
