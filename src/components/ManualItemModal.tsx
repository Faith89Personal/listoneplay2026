"use client";

import { useEffect, useState } from "react";
import {
  type ManualItem,
  useManualItems,
  CATEGORY_BY_ID,
} from "@/lib/useManualItems";
import { CloseIcon } from "@/components/icons";

const CATEGORY_OPTIONS = [
  { id: 1, label: "Tavolo" },
  { id: 2, label: "Ruolo" },
  { id: 3, label: "Libri" },
] as const;

type Props = {
  existing: ManualItem | null;
  onClose: () => void;
};

export default function ManualItemModal({ existing, onClose }: Props) {
  const { save, remove } = useManualItems();
  const [name, setName] = useState<string>(existing?.name ?? "");
  const [editor, setEditor] = useState<string>(existing?.editor ?? "");
  const [categoryId, setCategoryId] = useState<number>(
    existing?.categoryId ?? 1,
  );
  const [stand, setStand] = useState<string>(existing?.stand ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function commit() {
    const cleaned = name.trim();
    if (!cleaned) {
      setError("invalid_name");
      return;
    }
    if (!CATEGORY_BY_ID[categoryId]) {
      setError("invalid_category");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await save({
        id: existing?.id,
        name: cleaned,
        editor: editor.trim(),
        categoryId,
        stand: stand.trim() || null,
        idBgg: existing?.idBgg ?? null,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!existing) return;
    setBusy(true);
    setError(null);
    try {
      await remove(existing.id);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start gap-2">
          <div className="flex-1">
            <h2 className="text-base font-semibold text-neutral-900">
              {existing ? "Modifica gioco" : "Aggiungi gioco al listone"}
            </h2>
            <p className="text-xs text-neutral-600">
              Per giochi visti in fiera ma non presenti nel listone GSNT.
            </p>
          </div>
          <button
            type="button"
            aria-label="Chiudi"
            onClick={onClose}
            className="rounded p-1 text-neutral-500 active:bg-neutral-100"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {confirmDelete && existing ? (
          <div className="space-y-3">
            <p className="text-sm text-neutral-800">
              Rimuovere &laquo;{existing.name}&raquo; dal listone? Verranno
              cancellate anche le sue selezioni, prenotazioni e voto se
              presenti.
            </p>
            {error && (
              <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                Errore: {error}
              </p>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "…" : "Rimuovi"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">
                Nome
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                placeholder="es. Cthulhu Wars"
                className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
                required
              />
            </label>

            <div>
              <span className="mb-1 block text-xs font-medium text-neutral-600">
                Categoria
              </span>
              <div className="flex gap-1">
                {CATEGORY_OPTIONS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    className={
                      "flex-1 rounded-md border px-2 py-1.5 text-sm font-medium " +
                      (categoryId === c.id
                        ? "border-brand-dark bg-brand text-white"
                        : "border-neutral-300 bg-white text-neutral-700")
                    }
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">
                Editore (opzionale)
              </span>
              <input
                type="text"
                value={editor}
                onChange={(e) => setEditor(e.target.value)}
                maxLength={200}
                placeholder="es. Petersen Games"
                className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">
                Stand (opzionale)
              </span>
              <input
                type="text"
                value={stand}
                onChange={(e) => setStand(e.target.value)}
                maxLength={40}
                placeholder="es. D12"
                className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm uppercase"
              />
            </label>

            {error && (
              <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                {error === "invalid_name"
                  ? "Il nome è obbligatorio"
                  : error === "invalid_category"
                    ? "Categoria non valida"
                    : `Errore: ${error}`}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              {existing && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 active:bg-red-50 disabled:opacity-50"
                >
                  Rimuovi
                </button>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={commit}
                disabled={busy || name.trim().length === 0}
                className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "…" : existing ? "Aggiorna" : "Aggiungi"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
