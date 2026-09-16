"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Profesional {
  id: string;
  nombre_completo: string | null;
  empresa: string | null;
  nif_cif: string | null;
  telefono: string | null;
  telefono_contacto: string | null;
  tipo_negocio: string | null;
  b2b_aprobado: boolean;
  descuento_b2b: number;
  created_at: string;
  email: string;
}

interface Props {
  profesionales: Profesional[];
  total: number;
  totalPaginas: number;
  paginaActual: number;
  busqueda: string;
  filtro: "todos" | "pendientes" | "aprobados";
  pendientesCount: number;
}

export default function ProfesionalesListaClient({
  profesionales,
  total,
  totalPaginas,
  paginaActual,
  busqueda,
  filtro,
  pendientesCount,
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState(busqueda);

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (filtro !== "todos") params.set("filtro", filtro);
    params.set("pagina", "1");
    router.push(`/admin/profesionales?${params.toString()}`);
  }

  function handleFiltro(nuevoFiltro: "todos" | "pendientes" | "aprobados") {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (nuevoFiltro !== "todos") params.set("filtro", nuevoFiltro);
    params.set("pagina", "1");
    router.push(`/admin/profesionales?${params.toString()}`);
  }

  function handlePagina(p: number) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (filtro !== "todos") params.set("filtro", filtro);
    params.set("pagina", String(p));
    router.push(`/admin/profesionales?${params.toString()}`);
  }

  return (
    <div>
      {/* Buscador + filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <form onSubmit={handleBuscar} className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, email, empresa…"
            className="flex-1 border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-neutral-900 text-white text-sm hover:bg-neutral-800 transition-colors"
          >
            Buscar
          </button>
          {busqueda && (
            <Link
              href="/admin/profesionales"
              className="px-3 py-2 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              Limpiar
            </Link>
          )}
        </form>

        <div className="flex items-center gap-1">
          {(["todos", "pendientes", "aprobados"] as const).map((f) => (
            <button
              key={f}
              onClick={() => handleFiltro(f)}
              className={`text-xs px-3 py-1.5 transition-colors relative ${
                filtro === f
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {f === "todos" ? "Todos" : f === "pendientes" ? "Pendientes" : "Aprobados"}
              {f === "pendientes" && pendientesCount > 0 && (
                <span className={`ml-1.5 inline-block w-4 h-4 rounded-full text-[10px] leading-4 text-center ${
                  filtro === f ? "bg-white text-neutral-900" : "bg-amber-500 text-white"
                }`}>
                  {pendientesCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-neutral-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50">
              <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Nombre</th>
              <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Email</th>
              <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Empresa</th>
              <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Estado</th>
              <th className="text-right text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Dto.</th>
              <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Fecha</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {profesionales.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-neutral-400 text-sm">
                  {busqueda
                    ? `No se encontraron profesionales para "${busqueda}"`
                    : filtro === "pendientes"
                      ? "No hay solicitudes pendientes"
                      : "No hay profesionales registrados"}
                </td>
              </tr>
            ) : (
              profesionales.map((p) => (
                <tr key={p.id} className={`transition-colors ${
                  !p.b2b_aprobado ? "hover:bg-amber-50/30" : "hover:bg-neutral-50"
                }`}>
                  <td className="px-4 py-3 text-neutral-900">
                    {p.nombre_completo ?? "—"}
                    {p.tipo_negocio && (
                      <span className="block text-xs text-neutral-400">{p.tipo_negocio}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{p.email}</td>
                  <td className="px-4 py-3 text-neutral-700 font-medium">{p.empresa ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] tracking-wider uppercase px-2 py-0.5 rounded ${
                      p.b2b_aprobado
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        p.b2b_aprobado ? "bg-green-500" : "bg-amber-500"
                      }`} />
                      {p.b2b_aprobado ? "Aprobado" : "Pendiente"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-700">{p.descuento_b2b ?? 0}%</td>
                  <td className="px-4 py-3 text-neutral-500 text-xs whitespace-nowrap">
                    {new Date(p.created_at).toLocaleDateString("es-ES")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/profesionales/${p.id}`}
                      className="text-xs px-3 py-1.5 border border-neutral-200 hover:bg-neutral-100 transition-colors"
                    >
                      Ver ficha
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-neutral-400">
            Página {paginaActual} de {totalPaginas}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePagina(paginaActual - 1)}
              disabled={paginaActual <= 1}
              className="px-3 py-1.5 text-xs border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Anterior
            </button>
            {Array.from({ length: Math.min(totalPaginas, 7) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => handlePagina(p)}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    p === paginaActual
                      ? "bg-neutral-900 text-white"
                      : "border border-neutral-200 hover:bg-neutral-100"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            {totalPaginas > 7 && <span className="text-xs text-neutral-400 px-1">…</span>}
            {totalPaginas > 7 && (
              <button
                onClick={() => handlePagina(totalPaginas)}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  totalPaginas === paginaActual
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-200 hover:bg-neutral-100"
                }`}
              >
                {totalPaginas}
              </button>
            )}
            <button
              onClick={() => handlePagina(paginaActual + 1)}
              disabled={paginaActual >= totalPaginas}
              className="px-3 py-1.5 text-xs border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
