"use client";

import { useState, useEffect, useTransition } from "react";
import { actualizarPack } from "@/actions/packs";

interface PackOption {
  id: string;
  nombre: string;
  slug: string;
  items: { variacion_id: string; cantidad: number }[];
}

interface Props {
  variacionId: string;
  nombreProducto: string;
}

export function AnadirAPackBtn({ variacionId, nombreProducto }: Props) {
  const [abierto, setAbierto]       = useState(false);
  const [packs, setPacks]           = useState<PackOption[]>([]);
  const [cargando, setCargando]     = useState(false);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg]               = useState<string | null>(null);

  useEffect(() => {
    if (!abierto || packs.length > 0) return;
    setCargando(true);
    fetch("/api/packs")
      .then((r) => r.json())
      .then((data: PackOption[]) => setPacks(data))
      .finally(() => setCargando(false));
  }, [abierto, packs.length]);

  function estaEnPack(pack: PackOption) {
    return pack.items.some((i) => i.variacion_id === variacionId);
  }

  function toggleEnPack(pack: PackOption) {
    setMsg(null);
    const yaEsta = estaEnPack(pack);
    const nuevosItems = yaEsta
      ? pack.items.filter((i) => i.variacion_id !== variacionId)
      : [...pack.items, { variacion_id: variacionId, cantidad: 1 }];

    startTransition(async () => {
      // Necesitamos los datos completos del pack para actualizarPack
      const res = await fetch(`/api/packs/${pack.id}`);
      const packCompleto = await res.json();
      const { error } = await actualizarPack(pack.id, {
        ...packCompleto,
        items: nuevosItems,
      });
      if (error) { setMsg("Error: " + error); return; }
      setPacks((prev) =>
        prev.map((p) =>
          p.id === pack.id ? { ...p, items: nuevosItems } : p
        )
      );
      setMsg(yaEsta ? `Eliminado de "${pack.nombre}"` : `Añadido a "${pack.nombre}"`);
      setTimeout(() => setMsg(null), 3000);
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full py-3 border border-neutral-300 text-xs tracking-widest uppercase text-neutral-600 hover:border-neutral-600 hover:text-neutral-900 transition-colors"
      >
        🎁 Añadir a pack de regalo
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute left-0 right-0 mt-1 bg-white border border-neutral-200 shadow-xl z-20">
            <div className="px-4 py-2.5 border-b border-neutral-100 bg-neutral-50">
              <p className="text-xs text-neutral-500 line-clamp-1">
                <span className="font-medium text-neutral-700">{nombreProducto}</span>
              </p>
            </div>

            {cargando ? (
              <p className="px-4 py-6 text-xs text-neutral-400 text-center">Cargando packs…</p>
            ) : packs.length === 0 ? (
              <p className="px-4 py-6 text-xs text-neutral-400 text-center">
                No hay packs creados.{" "}
                <a href="/admin/packs/nuevo" target="_blank" className="underline hover:text-neutral-700">
                  Crear uno →
                </a>
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100 max-h-64 overflow-y-auto">
                {packs.map((pack) => {
                  const enPack = estaEnPack(pack);
                  return (
                    <li key={pack.id}>
                      <button
                        onClick={() => toggleEnPack(pack)}
                        disabled={isPending}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors text-left disabled:opacity-40"
                      >
                        <span className="text-sm text-neutral-800">{pack.nombre}</span>
                        <span className={`text-xs ml-3 shrink-0 ${enPack ? "text-green-700 font-medium" : "text-neutral-400"}`}>
                          {enPack ? "✓ Incluido" : "+ Añadir"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {msg && (
              <p className="px-4 py-2 text-xs border-t border-neutral-100 text-green-700 bg-green-50">{msg}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
