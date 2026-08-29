"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/authContext";
import { fetchNotifications, markAllNotificationsRead } from "@/lib/notifications";
import { relativeTime } from "@/lib/format";
import type { AppNotification } from "@/lib/types";

const POLL_MS = 45_000;

export function NotificationBell() {
  const { profile } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    async function load() {
      const rows = await fetchNotifications(profile!.id, 8);
      if (active) setItems(rows);
    }
    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [profile]);

  const unread = items.filter((n) => !n.read).length;

  async function handleMarkAllRead() {
    if (!profile) return;
    await markAllNotificationsRead(profile.id);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-line bg-surface text-[1.05rem]"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-danger px-1.5 py-0.5 text-[0.62rem] font-bold leading-none text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-[var(--radius-m)] border border-line bg-surface p-3 shadow-[var(--shadow-l)]">
            <div className="mb-1.5 flex items-center justify-between px-1">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs font-semibold text-primary hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="px-1 py-4 text-center text-xs text-muted">Nothing yet.</p>
            ) : (
              <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
                {items.map((n) => (
                  <li key={n.id} className={`rounded-[10px] px-2.5 py-2 ${n.read ? "" : "bg-primary-tint"}`}>
                    <b className="block text-[0.82rem]">{n.title}</b>
                    {n.body && <span className="block text-[0.76rem] text-ink-soft">{n.body}</span>}
                    <span className="text-[0.7rem] text-muted">{relativeTime(n.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="mt-2 block rounded-[10px] py-2 text-center text-xs font-semibold text-primary hover:bg-paper-alt"
            >
              See all notifications
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
