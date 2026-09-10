"use client";

import { useState, useRef } from "react";
import { subirFactura, eliminarFactura } from "@/actions/facturas";

interface Factura {
  id: string;
  nombre: string;
  archivo_path: string;
  archivo_size: number | null;
  created_at: string;
}

interface Props {
  profesionalId: string;
  profesionalNombre: string;
  facturasIniciales: Factura[];
}

export default function FacturasProfesional({
  profesionalId,
  profesionalNombre,
  facturasIniciales,
}: Props) {
  const [facturas, setFacturas] = useState(facturasIniciales);
  const [nombre, setNombre] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubir(e: React.FormEvent) {
    e.preventDefault();
    if (!archivo || !nombre.trim()) return;

    setSubiendo(true);
    setError(null);
    setExito(null);

    const res = await subirFactura(profesionalId, nombre, archivo);
    setSubiendo(false);

    if (res.error) {
      setError(res.error);
    } else {
      setExito(`Factura "${nombre}" subida correctamente.`);
      setNombre("");
      setArchivo(null);
      if (inputRef.current) inputRef.current.value = "";
      // Recargar lista
      const { listarFacturasProfesional } = await import("@/actions/facturas");
      const nuevas = await listarFacturasProfesional(profesionalId);
      setFacturas(nuevas);
    }
  }

  async function handleEliminar(id: string, nombreFactura: string) {
    if (!confirm(`¿Eliminar la factura "${nombreFactura}"?`)) return;

    const res = await eliminarFactura(id);
    if (res.error) {
      setError(res.error);
    } else {
      setFacturas((prev) => prev.filter((f) => f.id !== id));
    }
  }

  function formatBytes(bytes: number | null) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  return (
    <div className="border border-neutral-200 rounded-lg p-5 mt-4">
      <h3 className="text-xs tracking-widest uppercase text-neutral-500 mb-4 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        Facturas de {profesionalNombre}
      </h3>

      {/* Formulario de subida */}
      <form onSubmit={handleSubir} className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre (ej: Factura Enero 2026)"
          required
          className="flex-1 min-w-[200px] border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 transition-colors rounded"
        />
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          required
          className="text-sm text-neutral-600 file:mr-3 file:py-2 file:px-4 file:border-0 file:bg-neutral-900 file:text-white file:text-xs file:tracking-wider file:uppercase file:cursor-pointer file:rounded"
        />
        <button
          type="submit"
          disabled={subiendo || !archivo || !nombre.trim()}
          className="px-5 py-2 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 disabled:opacity-50 transition-colors rounded"
        >
          {subiendo ? "Subiendo…" : "Subir"}
        </button>
      </form>

      {error && (
        <p className="text-xs text-red-600 mb-3">{error}</p>
      )}
      {exito && (
        <p className="text-xs text-green-600 mb-3">{exito}</p>
      )}

      {/* Lista de facturas */}
      {facturas.length === 0 ? (
        <p className="text-xs text-neutral-400">Sin facturas subidas.</p>
      ) : (
        <div className="divide-y divide-neutral-100">
          {facturas.map((f) => (
            <div key={f.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-neutral-900">{f.nombre}</p>
                <p className="text-xs text-neutral-400">
                  {new Date(f.created_at).toLocaleDateString("es-ES")}
                  {f.archivo_size ? ` · ${formatBytes(f.archivo_size)}` : ""}
                </p>
              </div>
              <button
                onClick={() => handleEliminar(f.id, f.nombre)}
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
