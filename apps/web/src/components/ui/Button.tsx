"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./classNames";

export type ButtonVariant = "primary" | "outline" | "ghost" | "gold" | "danger";
export type ButtonSize = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors active:scale-[0.97] disabled:opacity-45 disabled:cursor-not-allowed";

const sizes: Record<ButtonSize, string> = {
  md: "px-5 py-2.5 text-sm",
  sm: "px-3.5 py-1.5 text-xs",
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white shadow-[var(--shadow-s)] hover:bg-primary-deep",
  outline: "border border-line text-ink hover:border-primary hover:text-primary",
  ghost: "bg-paper-alt text-ink-soft hover:text-ink",
  gold: "bg-accent text-white shadow-[var(--shadow-s)] hover:bg-accent-deep",
  danger: "bg-danger-tint text-danger hover:brightness-95",
};

export function buttonClassName(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cx(base, sizes[size], variants[variant], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export function Button({ variant = "primary", size = "md", className, children, ...rest }: ButtonProps) {
  return (
    <button className={buttonClassName(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClassName(variant, size, className)}>
      {children}
    </Link>
  );
}
