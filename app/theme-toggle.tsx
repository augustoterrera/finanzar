"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const themes: Array<{ label: string; value: Theme }> = [
  { label: "Claro", value: "light" },
  { label: "Oscuro", value: "dark" },
  { label: "Sistema", value: "system" },
];

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("theme") as Theme | null;

    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
      document.documentElement.dataset.theme = savedTheme;
      return;
    }

    document.documentElement.removeAttribute("data-theme");
  }, []);

  function changeTheme(nextTheme: Theme) {
    setTheme(nextTheme);

    if (nextTheme === "system") {
      window.localStorage.removeItem("theme");
      document.documentElement.removeAttribute("data-theme");
      return;
    }

    window.localStorage.setItem("theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }

  return (
    <div
      aria-label="Cambiar tema"
      className="inline-flex rounded-lg border border-border bg-surface p-1 shadow-[var(--shadow)]"
      role="group"
    >
      {themes.map((item) => {
        const isActive = theme === item.value;

        return (
          <button
            aria-pressed={isActive}
            className={`min-h-10 rounded-md px-4 text-sm font-semibold transition ${
              isActive
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
            key={item.value}
            onClick={() => changeTheme(item.value)}
            type="button"
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
