"use client";

import { useCallback, useEffect, useState } from "react";

type SessionState = {
  email: string | null;
  name: string | null;
  loading: boolean;
};

let cached: SessionState | null = null;
const listeners = new Set<(s: SessionState) => void>();

function setShared(next: SessionState) {
  cached = next;
  for (const fn of listeners) fn(next);
}

async function fetchMe(): Promise<{ email: string | null; name: string | null }> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return { email: null, name: null };
    const data = (await res.json()) as {
      email: string | null;
      name: string | null;
    };
    return { email: data.email ?? null, name: data.name ?? null };
  } catch {
    return { email: null, name: null };
  }
}

export function useSession() {
  const [state, setState] = useState<SessionState>(
    cached ?? { email: null, name: null, loading: true },
  );

  useEffect(() => {
    listeners.add(setState);
    if (!cached) {
      setShared({ email: null, name: null, loading: true });
      fetchMe().then(({ email, name }) =>
        setShared({ email, name, loading: false }),
      );
    }
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const login = useCallback(async (email: string, name?: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: name ?? null }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      const code = data.error || `http_${res.status}`;
      const err = new Error(code);
      (err as Error & { detail?: string }).detail = data.detail;
      throw err;
    }
    const data = (await res.json()) as {
      email: string;
      name: string | null;
    };
    setShared({ email: data.email, name: data.name ?? null, loading: false });
    return data.email;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setShared({ email: null, name: null, loading: false });
  }, []);

  return { ...state, login, logout };
}
