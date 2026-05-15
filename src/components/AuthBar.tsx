"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/useSession";

export default function AuthBar() {
  const { email, name, loading, logout } = useSession();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && email && (!name || name.trim().length === 0)) {
      setEditing(true);
    }
  }, [email, name, loading]);

  if (loading || !email) return null;

  const display = name || email;

  async function saveName() {
    const value = draft.trim();
    if (value.length === 0) {
      setError("invalid_name");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `http_${res.status}`);
      }
      // refresh session
      await fetch("/api/auth/me", { cache: "no-store" });
      window.location.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 pb-2 text-[11px] text-white/90">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={80}
          placeholder="Il tuo nome"
          className="flex-1 rounded bg-white/95 px-2 py-1 text-xs text-neutral-700 shadow-inner outline-none placeholder:text-neutral-400"
          autoFocus
        />
        <button
          type="button"
          onClick={saveName}
          disabled={busy || draft.trim().length === 0}
          className="rounded bg-white px-2 py-1 text-[11px] font-semibold text-brand-dark disabled:opacity-50"
        >
          {busy ? "…" : "Salva"}
        </button>
        {name && (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
            className="rounded bg-white/15 px-2 py-1 text-[11px]"
          >
            Annulla
          </button>
        )}
        {error && (
          <span className="absolute right-3 top-full mt-1 rounded bg-red-600 px-2 py-0.5 text-[10px] text-white shadow">
            {error === "invalid_name" ? "Nome obbligatorio" : `Errore: ${error}`}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 pb-2 text-[11px] text-white/90">
      <span className="flex-1 truncate">
        Ciao <span className="font-semibold">{display}</span>
      </span>
      <button
        type="button"
        onClick={() => {
          setDraft(name ?? "");
          setEditing(true);
        }}
        className="rounded bg-white/15 px-2 py-1 text-[11px] font-medium active:bg-white/25"
      >
        Cambia nome
      </button>
      <button
        type="button"
        onClick={async () => {
          setBusy(true);
          try {
            await logout();
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        className="rounded bg-white/15 px-2 py-1 text-[11px] font-medium active:bg-white/25 disabled:opacity-50"
      >
        Logout
      </button>
    </div>
  );
}
