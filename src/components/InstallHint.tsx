"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "listoneplay2026:install-hint:dismissed:v1";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  if (!isIos) return false;
  // Exclude in-app browsers (FB, IG, Twitter etc.) and Chrome on iOS (CriOS)
  return !/CriOS|FxiOS|EdgiOS|FBAN|FBAV|Instagram|Twitter|Line/i.test(ua);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return standalone || nav.standalone === true;
}

function ShareIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M12 16V4" />
      <polyline points="8 8 12 4 16 8" />
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
    </svg>
  );
}

export default function InstallHint() {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"ios" | "android" | null>(null);
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Already installed: do nothing
    if (isStandalone()) return;

    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // ignore
    }
    if (dismissed) return;

    if (isIosSafari()) {
      setMode("ios");
      setVisible(true);
      return;
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      const evt = e as BeforeInstallPromptEvent;
      setPromptEvent(evt);
      setMode("android");
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    function onInstalled() {
      setVisible(false);
    }
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  async function triggerAndroidInstall() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
    }
    setPromptEvent(null);
  }

  return (
    <div className="mx-auto mb-4 max-w-2xl rounded-2xl bg-brand-tint p-3 shadow-sm ring-1 ring-brand-soft">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-brand-dark shadow-sm">
          <ShareIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 text-sm leading-snug text-neutral-800">
          {mode === "ios" ? (
            <>
              <span className="font-semibold">
                Installa l&apos;app sul telefono
              </span>
              <p className="mt-0.5 text-xs text-neutral-700">
                Tocca il bottone Condividi di Safari (
                <span className="inline-block align-middle">
                  <ShareIcon className="inline-block h-3 w-3" />
                </span>
                ) e poi &laquo;Aggiungi a Home&raquo;.
              </p>
            </>
          ) : (
            <>
              <span className="font-semibold">Installa l&apos;app</span>
              <p className="mt-0.5 text-xs text-neutral-700">
                Aggiungi Listone Play alla home del telefono per aprirla con
                un tocco.
              </p>
            </>
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
      {mode === "android" && promptEvent && (
        <button
          type="button"
          onClick={triggerAndroidInstall}
          className="mt-3 w-full rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white shadow active:bg-brand-dark"
        >
          Installa
        </button>
      )}
    </div>
  );
}
