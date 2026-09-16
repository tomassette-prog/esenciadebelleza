"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Cliente {
  id: string;
  email: string;
  nombre_completo: string | null;
  empresa: string | null;
  nif_cif: string | null;
  telefono: string | null;
  tipo_cliente: string;
  b2b_aprobado: boolean;
  descuento_b2b: number;
  created_at: string;
}

interface Props {
  clientes: Cliente[];
  total: number;
  totalPaginas: number;
  paginaActual: number;
  busqueda: string;
  filtro: "todos" | "b2b" | "b2c";
}

export default function ClientesListaClient({
  clientes,
  total,
  totalPaginas,
  paginaActual,
  busqueda,
  filtro,
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState(busqueda);

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (filtro !== "todos") params.set("filtro", filtro);
    params.set("pagina", "1");
    router.push(`/admin/clientes?${params.toString()}`);
  }

  function handleFiltro(nuevoFiltro: "todos" | "b2b" | "b2c") {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (nuevoFiltro !== "todos") params.set("filtro", nuevoFiltro);
    params.set("pagina", "1");
    router.push(`/admin/clientes?${params.toString()}`);
  }

  function handlePagina(p: number) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (filtro !== "todos") params.set("filtro", filtro);
    params.set("pagina", String(p));
    router.push(`/admin/clientes?${params.toString()}`);
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
              href="/admin/clientes"
              className="px-3 py-2 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              Limpiar
            </Link>
          )}
        </form>

        <div className="flex items-center gap-1">
          {(["todos", "b2b", "b2c"] as const).map((f) => (
            <button
              key={f}
              onClick={() => handleFiltro(f)}
              className={`text-xs px-3 py-1.5 transition-colors ${
                filtro === f
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {f === "todos" ? "Todos" : f.toUpperCase()}
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
              <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Tipo</th>
              <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">NIF/CIF</th>
              <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Fecha</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {clientes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-neutral-400 text-sm">
                  {busqueda ? `No se encontraron clientes para "${busqueda}"` : "No hay clientes registrados"}
                </td>
              </tr>
            ) : (
              clientes.map((c) => (
                <tr key={c.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3 text-neutral-900">
                    {c.nombre_completo ?? c.empresa ?? "—"}
                    {c.empresa && c.nombre_completo && (
                      <span className="block text-xs text-neutral-400">{c.empresa}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{c.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] tracking-wider uppercase px-2 py-0.5 rounded ${
                      c.tipo_cliente === "b2b"
                        ? "bg-[#C4857A]/10 text-[#7A4A40]"
                        : "bg-neutral-100 text-neutral-500"
                    }`}>
                      {c.tipo_cliente === "b2b" ? "Profesional" : "Particular"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 text-xs">{c.nif_cif ?? "—"}</td>
                  <td className="px-4 py-3 text-neutral-500 text-xs whitespace-nowrap">
                    {new Date(c.created_at).toLocaleDateString("es-ES")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/clientes/${c.id}`}
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
