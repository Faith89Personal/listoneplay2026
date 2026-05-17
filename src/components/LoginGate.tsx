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
  const [step, setStep] = useState<"email" | "name">("email");
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

  const errorText = (code: string) =>
    code === "invalid_email"
      ? "Email non valida"
      : code === "db_unavailable"
        ? "Database non raggiungibile"
        : code === "session_error"
          ? "SESSION_SECRET mancante su Vercel"
          : `Errore: ${code}`;

  async function submitEmail() {
    const trimmedEmail = email.trim();
    if (busy || trimmedEmail.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        hasName?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || `http_${res.status}`);
        return;
      }
      if (data.hasName) {
        await session.login(trimmedEmail);
      } else {
        setStep("name");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitName() {
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    if (busy || trimmedName.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await session.login(trimmedEmail, trimmedName);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-tint via-white to-brand-tint px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-neutral-200">
        <div className="mb-4 text-center">
          <h1 className="text-xl font-bold tracking-tight text-brand-dark">
            {title}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>
        </div>
        {step === "email" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitEmail();
            }}
            className="space-y-3"
          >
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
                autoFocus
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
                {errorText(error)}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || email.trim().length === 0}
              className="w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow active:bg-brand-dark disabled:opacity-60"
            >
              {busy ? "…" : "Continua"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitName();
            }}
            className="space-y-3"
          >
            <p className="text-xs text-neutral-600">
              Primo accesso con <strong>{email.trim()}</strong>. Come ti
              chiami?
            </p>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">
                Nome
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="es. Marco"
                autoFocus
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                required
              />
            </label>
            {error && (
              <p
                role="alert"
                className="rounded bg-red-50 px-2 py-1 text-xs text-red-700"
              >
                {errorText(error)}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setError(null);
                }}
                className="rounded-md px-3 py-2 text-sm font-medium text-neutral-600 ring-1 ring-neutral-300 active:bg-neutral-100"
              >
                Indietro
              </button>
              <button
                type="submit"
                disabled={busy || name.trim().length === 0}
                className="flex-1 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow active:bg-brand-dark disabled:opacity-60"
              >
                {busy ? "…" : "Entra"}
              </button>
            </div>
          </form>
        )}
        <p className="mt-4 text-center text-[11px] text-neutral-500">
          Sessione valida 90 giorni. Niente password.
        </p>
      </div>
    </div>
  );
}
