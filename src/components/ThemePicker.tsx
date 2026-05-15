"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_THEME,
  THEMES,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "@/lib/themes";

function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed = JSON.parse(raw) as { id?: string };
    const id = parsed?.id;
    if (id && THEMES.some((t) => t.id === id)) return id as ThemeId;
  } catch {
    // ignore
  }
  return DEFAULT_THEME;
}

function PaletteIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 22a10 10 0 1 1 0-20c5.5 0 10 4 10 9 0 3-2 4-4 4h-2a2 2 0 0 0-2 2c0 1 1 2 1 3 0 1-1 2-3 2z" />
      <circle cx="7.5" cy="11" r="1.2" fill="currentColor" />
      <circle cx="11" cy="7.5" r="1.2" fill="currentColor" />
      <circle cx="16" cy="8.5" r="1.2" fill="currentColor" />
      <circle cx="17.5" cy="13" r="1.2" fill="currentColor" />
    </svg>
  );
}

export default function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    setCurrent(readStoredTheme());
  }, []);

  function apply(id: ThemeId) {
    document.documentElement.setAttribute("data-theme", id);
    try {
      window.localStorage.setItem(
        THEME_STORAGE_KEY,
        JSON.stringify({ id }),
      );
    } catch {
      // ignore
    }
    setCurrent(id);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Cambia colore tema"
        className="flex items-center justify-center rounded-md bg-white/15 p-1.5 active:bg-white/25"
      >
        <PaletteIcon className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-neutral-900">
                Colore tema
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-neutral-500"
              >
                Chiudi
              </button>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => apply(t.id)}
                  className="flex flex-col items-center gap-1"
                >
                  <span
                    className={
                      "h-10 w-10 rounded-full shadow-sm transition-transform " +
                      (current === t.id
                        ? "ring-2 ring-offset-2 ring-neutral-900 scale-105"
                        : "")
                    }
                    style={{ backgroundColor: t.swatch }}
                  />
                  <span className="text-[10px] text-neutral-600">
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
