"use client";

import { useState } from "react";
import { useSession } from "@/lib/useSession";

export default function AuthBar() {
  const { email, name, loading, logout } = useSession();
  const [busy, setBusy] = useState(false);

  if (loading || !email) return null;

  const display = name || email;

  return (
    <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 pb-2 text-[11px] text-white/90">
      <span className="flex-1 truncate">
        Ciao <span className="font-semibold">{display}</span>
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
