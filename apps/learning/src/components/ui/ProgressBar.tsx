export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="mb-2.5">
      {label && (
        <div className="mb-1 flex justify-between text-[0.76rem] text-muted">
          <span>{label}</span>
          <span className="text-ink">{clamped}%</span>
        </div>
      )}
      <div className="h-[9px] overflow-hidden rounded-full bg-paper-alt">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function StatCard({ value, label }: { value: ReactNodeLike; label: string }) {
  return (
    <div className="rounded-[var(--radius-m)] border border-line bg-surface p-4">
      <div className="font-display text-[1.9rem] text-primary-deep">{value}</div>
      <div className="text-[0.78rem] font-semibold text-muted">{label}</div>
    </div>
  );
}

// Kept loose on purpose: a stat value is usually a number or short string.
type ReactNodeLike = string | number;
