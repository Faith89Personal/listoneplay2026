"use client";

import { useState } from "react";
import { useSession } from "@/lib/useSession";

export default function AuthBar() {
  const { email, loading, login, logout } = useSession();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-3 pb-2 text-[11px] text-white/80">
        …
      </div>
    );
  }

  if (email) {
    return (
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 pb-2 text-[11px] text-white/90">
        <span className="flex-1 truncate">
          Connesso come <span className="font-semibold">{email}</span>
        </span>
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

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setError(null);
        setBusy(true);
        try {
          await login(input);
          setInput("");
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
      className="mx-auto flex max-w-2xl items-center gap-1.5 px-3 pb-2"
    >
      <input
        type="email"
        inputMode="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="email@esempio.it"
        className="flex-1 rounded-md bg-white/95 px-2 py-1 text-sm text-neutral-700 shadow-inner outline-none placeholder:text-neutral-400"
        required
      />
      <button
        type="submit"
        disabled={busy || input.length === 0}
        className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-brand-dark active:bg-white/90 disabled:opacity-60"
      >
        {busy ? "…" : "Entra"}
      </button>
      {error && (
        <span
          role="alert"
          className="absolute right-3 top-full mt-1 rounded bg-red-600 px-2 py-0.5 text-[10px] text-white shadow"
        >
          {error === "invalid_email" ? "Email non valida" : "Errore login"}
        </span>
      )}
    </form>
  );
}
