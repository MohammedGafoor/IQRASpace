"use client";

import { useEffect, useState } from "react";
import { setTheme } from "@/lib/theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    setTheme(next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-line bg-surface text-[1.05rem]"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
