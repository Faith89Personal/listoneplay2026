"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "listoneplay2026:notif-hint:dismissed:v1";

type Status = "unknown" | "unsupported" | "default" | "granted" | "denied";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

function BellIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export default function NotificationsHint() {
  const [status, setStatus] = useState<Status>("unknown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") {
        setDismissed(true);
      }
    } catch {
      // ignore
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    setStatus(Notification.permission as Status);
  }, []);

  if (status === "unsupported" || status === "granted" || dismissed) {
    return null;
  }
  if (status === "unknown") return null;

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      // ensure active
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission as Status);
        return;
      }

      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) {
        throw new Error("Public VAPID key missing on client");
      }

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid),
        });
      }
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `http_${res.status}`);
      }
      setStatus("granted");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  return (
    <div className="mx-auto mb-4 max-w-2xl rounded-2xl bg-amber-50 p-3 shadow-sm ring-1 ring-amber-200">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-amber-700 shadow-sm">
          <BellIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 text-sm leading-snug text-neutral-800">
          <span className="font-semibold">Attiva le notifiche</span>
          <p className="mt-0.5 text-xs text-neutral-700">
            Avviso immediato sul telefono quando qualcuno si unisce a una tua
            prenotazione, anche con app chiusa.
          </p>
          {status === "denied" && (
            <p className="mt-1 text-xs text-red-700">
              Permesso negato. Apri le impostazioni del browser per
              riattivare le notifiche per questo sito.
            </p>
          )}
          {error && (
            <p className="mt-1 text-xs text-red-700">Errore: {error}</p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Nascondi"
          className="text-neutral-500"
        >
          ×
        </button>
      </div>
      {status === "default" && (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="mt-3 w-full rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white shadow active:bg-amber-700 disabled:opacity-60"
        >
          {busy ? "…" : "Attiva notifiche"}
        </button>
      )}
    </div>
  );
}
