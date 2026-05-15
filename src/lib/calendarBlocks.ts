import type { Item } from "@/types";
import type { Reservation } from "@/lib/useReservations";
import type { ManualEvent } from "@/lib/useManualEvents";

export type CalendarBlockKind = "reservation" | "manual";

export type CalendarBlock = {
  key: string;
  kind: CalendarBlockKind;
  reservedAt: string;
  durationMinutes: number;
  title: string;
  editorName: string | null;
  stand: string | null;
  note: string | null;
  itemId: number | null;
  manualId: number | null;
  shared?: boolean;
  ownerEmail?: string;
};

export function reservationKey(itemId: number): string {
  return `r:${itemId}`;
}
export function manualKey(id: number): string {
  return `m:${id}`;
}

export function reservationToBlock(
  r: Reservation,
  item: Item | null,
  stands: string[],
  fallbackTitle?: string | null,
): CalendarBlock {
  return {
    key: reservationKey(r.itemId) + "/" + r.ownerEmail,
    kind: "reservation",
    reservedAt: r.reservedAt,
    durationMinutes: r.durationMinutes,
    title: item?.name ?? fallbackTitle ?? `#${r.itemId}`,
    editorName: item?.editor.name ?? null,
    stand: stands.length > 0 ? stands.join("·") : null,
    note: r.note,
    itemId: r.itemId,
    manualId: null,
    shared: !r.isOwner,
    ownerEmail: r.ownerEmail,
  };
}

export function manualToBlock(e: ManualEvent): CalendarBlock {
  return {
    key: manualKey(e.id),
    kind: "manual",
    reservedAt: e.reservedAt,
    durationMinutes: e.durationMinutes,
    title: e.name,
    editorName: null,
    stand: e.stand,
    note: e.note,
    itemId: null,
    manualId: e.id,
    shared: !e.isOwner,
    ownerEmail: e.ownerEmail,
  };
}

export function overlapsBetween(
  a: { reservedAt: string; durationMinutes: number },
  b: { reservedAt: string; durationMinutes: number },
): boolean {
  const aS = new Date(a.reservedAt).getTime();
  const aE = aS + a.durationMinutes * 60_000;
  const bS = new Date(b.reservedAt).getTime();
  const bE = bS + b.durationMinutes * 60_000;
  return aS < bE && bS < aE;
}

export function findBlockOverlaps(
  candidate: { key?: string; reservedAt: string; durationMinutes: number },
  blocks: CalendarBlock[],
): CalendarBlock[] {
  return blocks.filter(
    (b) => b.key !== candidate.key && overlapsBetween(candidate, b),
  );
}
