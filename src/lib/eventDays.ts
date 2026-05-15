// Hardcoded festival days. Italian local time is CEST (UTC+2) in late May.

export const EVENT_DAYS = [
  { date: "2026-05-22", short: "Ven", long: "Venerdì 22 mag" },
  { date: "2026-05-23", short: "Sab", long: "Sabato 23 mag" },
  { date: "2026-05-24", short: "Dom", long: "Domenica 24 mag" },
] as const;

export const EVENT_TZ_OFFSET_HOURS = 2; // CEST in May
export const EVENT_OPEN_HOUR = 9;
export const EVENT_CLOSE_HOUR = 23;

export function romeLocalToUtcIso(date: string, time: string): string {
  // date: "2026-05-22", time: "14:30"
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const utc = Date.UTC(y, m - 1, d, hh - EVENT_TZ_OFFSET_HOURS, mm);
  return new Date(utc).toISOString();
}

export function utcIsoToRomeParts(iso: string): {
  date: string;
  time: string;
  hour: number;
  minute: number;
  dayIndex: number;
} {
  const d = new Date(iso);
  const utcMs = d.getTime();
  const localMs = utcMs + EVENT_TZ_OFFSET_HOURS * 60 * 60 * 1000;
  const local = new Date(localMs);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + 1;
  const day = local.getUTCDate();
  const hour = local.getUTCHours();
  const minute = local.getUTCMinutes();
  const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const dayIndex = EVENT_DAYS.findIndex((e) => e.date === dateStr);
  return { date: dateStr, time: timeStr, hour, minute, dayIndex };
}

export function formatRangeShort(iso: string, durationMin: number): string {
  const p = utcIsoToRomeParts(iso);
  const endMs =
    new Date(iso).getTime() + durationMin * 60_000;
  const e = utcIsoToRomeParts(new Date(endMs).toISOString());
  const dayLabel = EVENT_DAYS[p.dayIndex]?.short ?? p.date.slice(8, 10);
  return `${dayLabel} ${p.time}–${e.time}`;
}
