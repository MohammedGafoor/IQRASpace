export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** "14:30:00" (Postgres TIME) -> "2:30 PM" */
export function formatTime(time: string | null | undefined) {
  if (!time) return null;
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** "2026-08-29" -> "Sat, Aug 29" */
export function formatDate(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function formatDateLong(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function combineDateTime(dateISO: string, time: string | null | undefined) {
  return new Date(`${dateISO}T${time ?? "00:00:00"}`);
}

/** "14:30" + 20 -> "14:50" (wraps at 24h; Postgres TIME "HH:MM" or "HH:MM:SS" in, "HH:MM" out). */
export function addMinutesToTime(time: string, minutes: number): string {
  const [hStr, mStr] = time.split(":");
  const totalMinutes = (((Number(hStr) * 60 + Number(mStr) + minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** A session's "10:00 AM – 10:20 AM" range from its start time + duration. */
export function computeEndTime(startTime: string | null | undefined, durationMinutes: number): string | null {
  if (!startTime) return null;
  return formatTime(addMinutesToTime(startTime, durationMinutes));
}

export function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
