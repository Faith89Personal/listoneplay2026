"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/useSession";
import { formatRangeShort, EVENT_DAYS, utcIsoToRomeParts } from "@/lib/eventDays";

type JoinReservation = {
  itemId: number;
  itemName: string;
  editor: string;
  stand: string | null;
  reservedAt: string;
  durationMinutes: number;
  note: string | null;
  maxSeats: number | null;
  occupied: number;
  isFull: boolean;
};

type Viewer = {
  loggedIn: boolean;
  email: string | null;
  isOwner: boolean;
  isJoined: boolean;
};

type Payload = { reservation: JoinReservation; viewer: Viewer };

export default function JoinReservationView({ token }: { token: string }) {
  const session = useSession();
  const [data, setData] = useState<Payload | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [emailInput, setEmailInput] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reservations/r/${token}`, {
        cache: "no-store",
      });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const json = (await res.json()) as Payload;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload, session.email]);

  async function handleJoin() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/r/${token}`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `http_${res.status}`);
      }
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/r/${token}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `http_${res.status}`);
      }
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin() {
    if (!emailInput.trim()) return;
    setLoginBusy(true);
    setLoginError(null);
    try {
      await session.login(emailInput.trim());
      // Session changed: reload will re-run via effect dep on session.email
    } catch (err) {
      const message = (err as Error).message;
      setLoginError(message);
    } finally {
      setLoginBusy(false);
    }
  }

  return (
    <>
      <header className="bg-gradient-to-b from-brand to-brand-dark text-white shadow-lg">
        <div className="mx-auto flex max-w-md items-center gap-2 px-3 py-3">
          <Link href="/" className="text-sm font-bold tracking-tight">
            Listone Play 2026
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-24 pt-6">
        {loading && (
          <p className="text-center text-sm text-neutral-500">Carico…</p>
        )}

        {notFound && !loading && (
          <div className="text-center">
            <p className="text-sm text-neutral-700">
              Prenotazione non trovata o link non più valido.
            </p>
            <Link
              href="/"
              className="mt-3 inline-block rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow"
            >
              Vai al listone
            </Link>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-dark">
                Prenotazione condivisa
              </p>
              <h1 className="mt-1 text-lg font-bold text-neutral-900">
                {data.reservation.itemName}
              </h1>
              {data.reservation.editor && (
                <p className="text-sm text-neutral-600">
                  {data.reservation.editor}
                  {data.reservation.stand ? ` · ${data.reservation.stand}` : ""}
                </p>
              )}
              <p className="mt-3 text-sm text-neutral-800">
                📅{" "}
                {(EVENT_DAYS.find(
                  (d) =>
                    d.date === utcIsoToRomeParts(data.reservation.reservedAt).date,
                )?.long ?? "")}{" "}
                ·{" "}
                {formatRangeShort(
                  data.reservation.reservedAt,
                  data.reservation.durationMinutes,
                )}
              </p>
              {data.reservation.note && (
                <p className="mt-1 text-sm italic text-neutral-600">
                  &laquo;{data.reservation.note}&raquo;
                </p>
              )}
              {data.reservation.maxSeats !== null && (
                <p className="mt-2 text-sm font-semibold text-amber-700">
                  👥 {data.reservation.occupied}/{data.reservation.maxSeats}{" "}
                  posti occupati
                </p>
              )}
            </div>

            {!data.viewer.loggedIn && (
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
                <p className="text-sm text-neutral-800">
                  Accedi con la tua email per aggiungerti alla prenotazione.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleLogin();
                  }}
                  className="mt-3 flex gap-2"
                >
                  <input
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="email@esempio.it"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                    required
                  />
                  <button
                    type="submit"
                    disabled={loginBusy || !emailInput.trim()}
                    className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {loginBusy ? "…" : "Entra"}
                  </button>
                </form>
                {loginError && (
                  <p className="mt-2 text-xs text-red-700">
                    Errore login: {loginError}
                  </p>
                )}
              </div>
            )}

            {data.viewer.loggedIn && data.viewer.isOwner && (
              <div className="rounded-2xl bg-brand-tint p-4 text-sm text-neutral-800 ring-1 ring-brand-soft">
                Sei tu il proprietario di questa prenotazione.
              </div>
            )}

            {data.viewer.loggedIn &&
              !data.viewer.isOwner &&
              data.viewer.isJoined && (
                <div className="space-y-2">
                  <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
                    Sei iscritto a questa prenotazione. La trovi nel tuo
                    calendario.
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleLeave}
                    className="w-full rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 active:bg-red-50 disabled:opacity-50"
                  >
                    {busy ? "…" : "Rimuovi dal mio calendario"}
                  </button>
                </div>
              )}

            {data.viewer.loggedIn &&
              !data.viewer.isOwner &&
              !data.viewer.isJoined && (
                <div className="space-y-2">
                  {data.reservation.isFull ? (
                    <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
                      I posti per questa prenotazione sono esauriti.
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleJoin}
                      className="w-full rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white active:bg-brand-dark disabled:opacity-50"
                    >
                      {busy ? "…" : "Aggiungimi alla prenotazione"}
                    </button>
                  )}
                </div>
              )}

            {error && (
              <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                Errore: {error}
              </p>
            )}

            <Link
              href="/"
              className="block text-center text-xs text-neutral-500 underline"
            >
              Torna al listone
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
