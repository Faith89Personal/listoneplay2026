"use client";

import { useEffect } from "react";
import {
  EVENT_DAYS,
  formatRangeShort,
  utcIsoToRomeParts,
} from "@/lib/eventDays";
import { CalendarIcon, CloseIcon } from "@/components/icons";

function emailToName(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

export type CommonDetail = {
  kind: "reservation" | "manual";
  title: string;
  reservedAt: string;
  durationMinutes: number;
  editorName: string | null;
  stand: string | null;
  note: string | null;
  ownerEmail: string;
  sharedWith: string[];
  guests: string[];
  maxSeats: number | null;
};

type Props = {
  detail: CommonDetail;
  participantNames: Record<string, string>;
  onClose: () => void;
};

export default function CommonDetailModal({
  detail,
  participantNames,
  onClose,
}: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const nameOf = (email: string) =>
    participantNames[email] || emailToName(email);

  const dayLong =
    EVENT_DAYS.find(
      (d) => d.date === utcIsoToRomeParts(detail.reservedAt).date,
    )?.long ?? "";
  const range = formatRangeShort(detail.reservedAt, detail.durationMinutes);
  const occupancy =
    1 + detail.sharedWith.length + detail.guests.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start gap-2">
          <div className="flex-1">
            <h2 className="flex items-center gap-1.5 text-base font-semibold text-neutral-900">
              <CalendarIcon className="h-5 w-5 text-brand" />
              {detail.kind === "manual" ? "Evento" : "Prenotazione"}
            </h2>
            <p className="line-clamp-2 text-sm font-medium text-neutral-800">
              {detail.title}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              di <span className="font-semibold">{nameOf(detail.ownerEmail)}</span>
            </p>
          </div>
          <button
            type="button"
            aria-label="Chiudi"
            onClick={onClose}
            className="rounded p-1 text-neutral-500 active:bg-neutral-100"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2 text-sm text-neutral-800">
          <p>📅 {dayLong} · {range}</p>
          {(detail.editorName || detail.stand) && (
            <p>
              {detail.editorName && <span>🏢 {detail.editorName}</span>}
              {detail.editorName && detail.stand && <span> · </span>}
              {detail.stand && <span>📍 {detail.stand}</span>}
            </p>
          )}
          <p>
            👥 {occupancy}
            {detail.maxSeats !== null ? `/${detail.maxSeats}` : ""} posti
            occupati
          </p>
          {(detail.sharedWith.length > 0 || detail.guests.length > 0) && (
            <div className="rounded-lg bg-neutral-50 p-2">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Partecipanti
              </p>
              <ul className="space-y-0.5 text-xs text-neutral-700">
                <li>{nameOf(detail.ownerEmail)} (organizza)</li>
                {detail.sharedWith.map((e) => (
                  <li key={e}>{nameOf(e)}</li>
                ))}
                {detail.guests.map((g, i) => (
                  <li key={`g${i}`}>{g} (ospite)</li>
                ))}
              </ul>
            </div>
          )}
          {detail.note && (
            <p className="text-xs italic text-neutral-600">
              &ldquo;{detail.note}&rdquo;
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-brand px-4 py-1.5 text-sm font-semibold text-white"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
