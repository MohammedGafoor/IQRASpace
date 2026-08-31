"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";
import { fetchNotifications, markAllNotificationsRead } from "@/lib/notifications";
import { relativeTime } from "@/lib/format";
import type { AppNotification } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

const TYPE_ICON: Record<string, string> = {
  lesson_scheduled: "📅",
  attendance_marked: "✅",
  lesson_note_added: "📝",
  sharing_started: "📤",
  system: "🔔",
};

export default function NotificationsPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!profile) return;
    setItems(await fetchNotifications(profile.id, 50));
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function handleMarkAllRead() {
    if (!profile) return;
    await markAllNotificationsRead(profile.id);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
          Mark all as read
        </Button>
      </div>
      <Card>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : items.length === 0 ? (
          <EmptyState icon="🔔">You&rsquo;re all caught up.</EmptyState>
        ) : (
          <ul className="flex flex-col">
            {items.map((n) => (
              <li key={n.id} className={`flex items-center gap-3 border-b border-line py-3 last:border-0 ${n.read ? "" : "bg-primary-tint/40"}`}>
                <span className="text-xl">{TYPE_ICON[n.type] ?? "🔔"}</span>
                <div className="flex-1">
                  <b className="block text-sm">{n.title}</b>
                  {n.body && <span className="text-xs text-muted">{n.body}</span>}
                </div>
                <span className="text-xs text-muted">{relativeTime(n.created_at)}</span>
                {!n.read && <span className="h-2 w-2 rounded-full bg-accent" />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
