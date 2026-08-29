import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./classNames";

export function Card({
  children,
  className,
  padded = true,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; padded?: boolean }) {
  return (
    <div
      className={cx(
        "rounded-[var(--radius-l)] border border-line bg-surface shadow-[var(--shadow-s)]",
        padded && "p-5",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="mb-2 inline-block text-[0.72rem] font-bold uppercase tracking-[0.12em] text-primary">
      {children}
    </span>
  );
}

export function SectionHead({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h3 className="text-lg font-semibold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
