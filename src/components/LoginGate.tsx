"use client";

import { useState } from "react";
import { useSession } from "@/lib/useSession";

type Props = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
};

export default function LoginGate({
  children,
  title = "Listone Play 2026",
  subtitle = "Accedi per continuare. Solo per noi.",
}: Props) {
  const session = useSession();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Caricamento…
      </div>
    );
  }

  if (session.email) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-tint via-white to-brand-tint px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-neutral-200">
        <div className="mb-4 text-center">
          <h1 className="text-xl font-bold tracking-tight text-brand-dark">
            {title}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError(null);
            try {
              await session.login(email.trim(), name.trim() || undefined);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">
              Nome (opzionale)
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="es. Marco"
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">
              Email
            </span>
            <input
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@esempio.it"
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
              required
            />
          </label>
          {error && (
            <p
              role="alert"
              className="rounded bg-red-50 px-2 py-1 text-xs text-red-700"
            >
              {error === "invalid_email"
                ? "Email non valida"
                : error === "db_unavailable"
                  ? "Database non raggiungibile"
                  : error === "session_error"
                    ? "SESSION_SECRET mancante su Vercel"
                    : `Errore: ${error}`}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || email.trim().length === 0}
            className="w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow active:bg-brand-dark disabled:opacity-60"
          >
            {busy ? "…" : "Entra"}
          </button>
        </form>
        <p className="mt-4 text-center text-[11px] text-neutral-500">
          Sessione valida 90 giorni. Niente password.
        </p>
      </div>
    </div>
  );
}
