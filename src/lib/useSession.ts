"use client";

import { useCallback, useEffect, useState } from "react";

type SessionState = {
  email: string | null;
  loading: boolean;
};

let cached: SessionState | null = null;
const listeners = new Set<(s: SessionState) => void>();

function setShared(next: SessionState) {
  cached = next;
  for (const fn of listeners) fn(next);
}

async function fetchMe(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { email: string | null };
    return data.email ?? null;
  } catch {
    return null;
  }
}

export function useSession() {
  const [state, setState] = useState<SessionState>(
    cached ?? { email: null, loading: true },
  );

  useEffect(() => {
    listeners.add(setState);
    if (!cached) {
      setShared({ email: null, loading: true });
      fetchMe().then((email) => setShared({ email, loading: false }));
    }
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const login = useCallback(async (email: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(data.error || "login_failed");
    }
    const data = (await res.json()) as { email: string };
    setShared({ email: data.email, loading: false });
    return data.email;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setShared({ email: null, loading: false });
  }, []);

  return { ...state, login, logout };
}
