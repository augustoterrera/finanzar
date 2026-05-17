"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";

const themes: Array<{ label: string; value: Theme }> = [
  { label: "Claro", value: "light" },
  { label: "Oscuro", value: "dark" },
  { label: "Sistema", value: "system" },
];

const themeChangeEvent = "finanzar-theme-change";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") {
    return "system";
  }

  const savedTheme = window.localStorage.getItem("theme");

  return savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : "system";
}

function subscribeToThemeChanges(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(themeChangeEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(themeChangeEvent, onStoreChange);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeToThemeChanges,
    getStoredTheme,
    () => "system",
  );

  useEffect(() => {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
      return;
    }

    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function changeTheme(nextTheme: Theme) {
    if (nextTheme === "system") {
      window.localStorage.removeItem("theme");
      window.dispatchEvent(new Event(themeChangeEvent));
      return;
    }

    window.localStorage.setItem("theme", nextTheme);
    window.dispatchEvent(new Event(themeChangeEvent));
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
