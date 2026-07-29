"use client";

import { useState, useTransition } from "react";
import {
  diagnosticarProductosMerchant,
  activarVariaciones,
  type DiagnosticoProducto,
} from "@/actions/merchant-diagnostico";

interface Diagnostico {
  total: number;
  sinVariaciones: DiagnosticoProducto[];
  sinPrecio: DiagnosticoProducto[];
  sinNombre: DiagnosticoProducto[];
  sinImagen: DiagnosticoProducto[];
}

export default function MerchantDiagnostico() {
  const [diag, setDiag] = useState<Diagnostico | null>(null);
  const [loading, startTransition] = useTransition();
  const [fixing, startFix] = useTransition();
  const [fixResult, setFixResult] = useState<string | null>(null);

  function ejecutarDiagnostico() {
    startTransition(async () => {
      const result = await diagnosticarProductosMerchant();
      setDiag(result);
    });
  }

  function arreglarAvailability() {
    if (!diag?.sinVariaciones.length) return;
    const ids = diag.sinVariaciones.map((p) => p.id);
    // Confirmación temporalmente deshabilitada para activación masiva via admin
    // if (!window.confirm(`¿Activar variaciones de ${ids.length} productos?`)) return;

    startFix(async () => {
      const result = await activarVariaciones(ids);
      if (result.ok) {
        const partes = [];
        if (result.actualizados > 0) partes.push(`${result.actualizados} activadas`);
        if (result.insertados > 0) partes.push(`${result.insertados} creadas`);
        setFixResult(`✅ ${partes.join(", ")}. Ejecuta el diagnóstico de nuevo para verificar.`);
      } else {
        setFixResult(`❌ Error: ${result.error}`);
      }
      setTimeout(() => setFixResult(null), 8000);
    });
  }

  const totalProblemas = diag
    ? diag.sinVariaciones.length + diag.sinPrecio.length + diag.sinNombre.length + diag.sinImagen.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={ejecutarDiagnostico}
          disabled={loading}
          className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 font-medium"
        >
          {loading ? "Analizando…" : "🔍 Ejecutar diagnóstico"}
        </button>
        {diag && (
          <span className="text-sm text-gray-500">
            {diag.total} productos analizados · {totalProblemas} problemas encontrados
          </span>
        )}
      </div>

      {fixResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
          {fixResult}
        </div>
      )}

      {diag && (
        <div className="space-y-6">
          {/* Availability */}
          <SeccionDiagnostico
            titulo="🔴 Sin variaciones activas (availability)"
            descripcion="Google no puede mostrar disponibilidad. Estos productos no aparecerán en Shopping."
            productos={diag.sinVariaciones}
            accion={
              diag.sinVariaciones.length > 0 ? (
                <button
                  onClick={arreglarAvailability}
                  disabled={fixing}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {fixing ? "Activando…" : `Activar ${diag.sinVariaciones.length} productos`}
                </button>
              ) : undefined
            }
          />

          {/* Price */}
          <SeccionDiagnostico
            titulo="🟡 Sin precio"
            descripcion="Google no puede mostrar el precio. Revisa que las variaciones tengan precio_b2c."
            productos={diag.sinPrecio}
          />

          {/* Title */}
          <SeccionDiagnostico
            titulo="🟠 Nombre genérico"
            descripcion="El título aparece como 'Unidad' en Google. El producto necesita un nombre real."
            productos={diag.sinNombre}
          />

          {/* Image */}
          <SeccionDiagnostico
            titulo="🔵 Sin imagen"
            descripcion="Sin imagen principal. Google puede rechazar el producto."
            productos={diag.sinImagen}
          />
        </div>
      )}
    </div>
  );
}

function SeccionDiagnostico({
  titulo,
  descripcion,
  productos,
  accion,
}: {
  titulo: string;
  descripcion: string;
  productos: DiagnosticoProducto[];
  accion?: React.ReactNode;
}) {
  if (productos.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-sm text-green-700 font-medium">{titulo}: ✅ Sin problemas</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900 text-sm">
            {titulo} ({productos.length})
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{descripcion}</p>
        </div>
        {accion}
      </div>
      <div className="max-h-64 overflow-y-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Producto</th>
              <th className="px-3 py-2 text-left">Categoría</th>
              <th className="px-3 py-2 text-left">Problema</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {productos.slice(0, 50).map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <a
                    href={`/admin/productos`}
                    className="text-rose-600 hover:underline font-medium"
                    title={p.id}
                  >
                    {p.nombre}
                  </a>
                </td>
                <td className="px-3 py-2 text-gray-500">{p.categoria}</td>
                <td className="px-3 py-2 text-gray-500">{p.problemas.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {productos.length > 50 && (
          <p className="px-3 py-2 text-xs text-gray-400 text-center">
            Mostrando 50 de {productos.length}…
          </p>
        )}
      </div>
    </div>
  );
}
