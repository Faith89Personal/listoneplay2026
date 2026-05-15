export type ThemeId =
  | "green"
  | "blue"
  | "teal"
  | "indigo"
  | "violet"
  | "fuchsia"
  | "rose"
  | "orange"
  | "amber"
  | "slate";

export const THEMES: Array<{ id: ThemeId; label: string; swatch: string }> = [
  { id: "green", label: "Verde", swatch: "#15803d" },
  { id: "teal", label: "Teal", swatch: "#14b8a6" },
  { id: "blue", label: "Blu", swatch: "#3b82f6" },
  { id: "indigo", label: "Indigo", swatch: "#6366f1" },
  { id: "violet", label: "Viola", swatch: "#8b5cf6" },
  { id: "fuchsia", label: "Fucsia", swatch: "#d946ef" },
  { id: "rose", label: "Rosa", swatch: "#f43f5e" },
  { id: "orange", label: "Arancio", swatch: "#f97316" },
  { id: "amber", label: "Ambra", swatch: "#f59e0b" },
  { id: "slate", label: "Grafite", swatch: "#64748b" },
];

export const DEFAULT_THEME: ThemeId = "green";
export const THEME_STORAGE_KEY = "listoneplay2026:theme:v1";
