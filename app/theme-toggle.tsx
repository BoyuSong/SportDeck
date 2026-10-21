"use client";

import { useTheme } from "@/app/providers";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--surface-strong-foreground)] shadow-sm transition hover:opacity-90"
    >
      {theme === "dark" ? "Light Mode" : "Dark Mode"}
    </button>
  );
}
