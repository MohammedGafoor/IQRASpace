"use client";

import type { ReactNode } from "react";

export function Modal({
  open,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative max-h-[88vh] w-full ${
          wide ? "max-w-2xl" : "max-w-lg"
        } overflow-y-auto overflow-x-hidden rounded-[var(--radius-l)] bg-surface p-6 shadow-[var(--shadow-l)]`}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-paper-alt text-sm hover:brightness-95"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
