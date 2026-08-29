import { cx } from "./classNames";

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { value: T; label: string }[];
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="mb-4 flex gap-1.5 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            "-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
            active === t.value
              ? "border-primary text-primary-deep"
              : "border-transparent text-muted hover:text-ink"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function ViewToggle<T extends string>({
  options,
  active,
  onChange,
}: {
  options: { value: T; label: string }[];
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex gap-1 rounded-full bg-paper-alt p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-full px-3.5 py-1.5 text-[0.78rem] font-bold transition-colors",
            active === o.value ? "bg-surface text-primary-deep shadow-[var(--shadow-s)]" : "text-muted"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
