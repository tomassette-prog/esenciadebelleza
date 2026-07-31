"use client";

import { useState, useTransition } from "react";
import { sincronizarPrecios, sincronizarTodosPrecios } from "@/actions/sync-precios";

export function PreciosSync() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noEncontrados, setNoEncontrados] = useState<string[]>([]);

  function handleSyncMissing() {
    setError(null);
    setResult(null);
    setNoEncontrados([]);
    startTransition(async () => {
      const res = await sincronizarPrecios();
      if (res.error) { setError(res.error); return; }
      setResult(`✅ ${res.actualizados} precios actualizados de ${res.ok} productos sin precio. ${res.sinMatch} sin coincidencia en WC.`);
    });
  }

  function handleSyncAll() {
    if (!confirm("¿Actualizar precios de TODOS los productos contra depeluqueriaproductos.com? Esto puede tardar varios minutos.")) return;
    setError(null);
    setResult(null);
    setNoEncontrados([]);
    startTransition(async () => {
      const res = await sincronizarTodosPrecios();
      if (res.error) { setError(res.error); return; }
      setResult(`✅ ${res.actualizados} precios actualizados de ${res.ok} productos en WooCommerce. ${res.noEncontrados} sin coincidencia en Esencia (revisar abajo).`);
      setNoEncontrados(res.noEncontradosList ?? []);
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
          Sincronizar Precios
        </h2>
        <p className="text-sm text-neutral-400 mt-1">
          Actualiza precios, stock y ofertas desde depeluqueriaproductos.com
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {result && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-sm">
          {result}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sync missing prices */}
        <div className="border border-neutral-200 bg-white p-5 space-y-3">
          <h3 className="font-medium text-sm text-neutral-900">Productos sin precio</h3>
          <p className="text-xs text-neutral-400">
            Busca productos en Esencia que no tienen precio y los actualiza desde WooCommerce.
            También actualiza imágenes faltantes.
          </p>
          <button
            onClick={handleSyncMissing}
            disabled={isPending}
            className="w-full px-4 py-2.5 bg-[#3D2018] text-white text-xs tracking-widest uppercase hover:bg-neutral-900 disabled:opacity-40 transition-colors"
          >
            {isPending ? "Sincronizando…" : "Sincronizar precios vacíos"}
          </button>
        </div>

        {/* Sync ALL prices */}
        <div className="border border-neutral-200 bg-white p-5 space-y-3">
          <h3 className="font-medium text-sm text-neutral-900">Actualizar todos los precios</h3>
          <p className="text-xs text-neutral-400">
            Actualiza precios, stock y ofertas de TODOS los productos que ya existen en Esencia.
            Útil para refrescar después de cambios masivos en WC.
          </p>
          <button
            onClick={handleSyncAll}
            disabled={isPending}
            className="w-full px-4 py-2.5 bg-neutral-200 text-neutral-800 text-xs tracking-widest uppercase hover:bg-neutral-300 disabled:opacity-40 transition-colors"
          >
            {isPending ? "Sincronizando…" : "Actualizar todos los precios"}
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-xs">
        <strong>Nota:</strong> La sincronización descarga todos los productos de WooCommerce (~3000+).
        Tarda entre 30 segundos y 2 minutos según la carga del servidor.
      </div>

      {noEncontrados.length > 0 && (
        <div className="border border-red-200 bg-red-50 p-4 space-y-2">
          <h3 className="text-sm font-medium text-red-700">
            ⚠️ {noEncontrados.length} productos sin coincidencia (revisar manualmente)
          </h3>
          <p className="text-xs text-red-600">
            Estos productos existen en WooCommerce pero no se pudo emparejar con ningún producto de Esencia (ni por SKU ni por woo_id). Sus precios NO se actualizaron.
          </p>
          <ul className="text-xs text-red-700 list-disc list-inside max-h-48 overflow-y-auto space-y-0.5">
            {noEncontrados.map((nombre, i) => <li key={i}>{nombre}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
