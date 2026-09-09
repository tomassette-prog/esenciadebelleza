"use client";

import { useState, useTransition } from "react";
import { crearCupon, actualizarCupon, eliminarCupon } from "@/actions/cupones";
import type { Cupon } from "@/actions/cupones";

interface Props {
  cuponesInitial: Cupon[];
}

export default function CuponesClient({ cuponesInitial }: Props) {
  const [cupones, setCupones] = useState(cuponesInitial);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<"porcentaje" | "fijo">("porcentaje");
  const [valor, setValor] = useState("");
  const [usosMaximos, setUsosMaximos] = useState("");
  const [fechaExpiracion, setFechaExpiracion] = useState("");
  const [importeMinimo, setImporteMinimo] = useState("");

  function resetForm() {
    setCodigo(""); setDescripcion(""); setTipo("porcentaje"); setValor("");
    setUsosMaximos(""); setFechaExpiracion(""); setImporteMinimo("");
    setMostrarForm(false); setError(null);
  }

  function handleCrear() {
    if (!codigo.trim() || !valor) return;
    setError(null);
    startTransition(async () => {
      const res = await crearCupon({
        codigo: codigo.trim(),
        descripcion: descripcion.trim() || undefined,
        tipo,
        valor: Number(valor),
        usos_maximos: usosMaximos ? Number(usosMaximos) : undefined,
        fecha_expiracion: fechaExpiracion || undefined,
        importe_minimo: importeMinimo ? Number(importeMinimo) : undefined,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setCupones((prev) => [
          {
            id: res.cuponId!,
            codigo: codigo.toUpperCase().trim(),
            descripcion: descripcion.trim() || null,
            tipo,
            valor: Number(valor),
            usos_maximos: usosMaximos ? Number(usosMaximos) : null,
            usos_actuales: 0,
            fecha_expiracion: fechaExpiracion || null,
            importe_minimo: importeMinimo ? Number(importeMinimo) : 0,
            activo: true,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        resetForm();
      }
    });
  }

  function handleToggleActivo(cupon: Cupon) {
    startTransition(async () => {
      await actualizarCupon(cupon.id, { activo: !cupon.activo });
      setCupones((prev) =>
        prev.map((c) => (c.id === cupon.id ? { ...c, activo: !c.activo } : c))
      );
    });
  }

  function handleEliminar(id: string) {
    if (!confirm("¿Eliminar este cupón?")) return;
    startTransition(async () => {
      const res = await eliminarCupon(id);
      if (!res.error) setCupones((prev) => prev.filter((c) => c.id !== id));
    });
  }

  function estadoCupon(c: Cupon): { label: string; color: string } {
    if (!c.activo) return { label: "Inactivo", color: "bg-neutral-100 text-neutral-600" };
    if (c.fecha_expiracion && new Date(c.fecha_expiracion) < new Date())
      return { label: "Expirado", color: "bg-red-50 text-red-700" };
    if (c.usos_maximos !== null && c.usos_actuales >= c.usos_maximos)
      return { label: "Agotado", color: "bg-amber-50 text-amber-700" };
    return { label: "Activo", color: "bg-green-50 text-green-700" };
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
            Cupones de descuento
          </h1>
          <p className="text-sm text-neutral-500 mt-1">{cupones.length} cupones</p>
        </div>
        <button
          onClick={() => setMostrarForm(!mostrarForm)}
          className="text-xs tracking-widest uppercase bg-neutral-900 text-white px-5 py-2.5 hover:bg-neutral-700 transition-colors"
        >
          {mostrarForm ? "Cancelar" : "+ Nuevo cupón"}
        </button>
      </div>

      {/* Formulario de creación */}
      {mostrarForm && (
        <div className="bg-white border border-neutral-200 p-6 mb-8">
          <h2 className="text-xs tracking-widest uppercase text-neutral-500 mb-4">Crear cupón</h2>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1">Código *</label>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="VERANO2026" className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900" />
            </div>
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1">Descripción</label>
              <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descuento de verano" className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900" />
            </div>
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1">Tipo *</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as "porcentaje" | "fijo")} className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 bg-white">
                <option value="porcentaje">Porcentaje (%)</option>
                <option value="fijo">Importe fijo (€)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1">Valor *</label>
              <input type="number" min="0" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={tipo === "porcentaje" ? "10" : "5.00"} className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900" />
            </div>
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1">Usos máximos</label>
              <input type="number" min="1" value={usosMaximos} onChange={(e) => setUsosMaximos(e.target.value)} placeholder="Dejar vacío = ilimitado" className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900" />
            </div>
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1">Fecha de expiración</label>
              <input type="datetime-local" value={fechaExpiracion} onChange={(e) => setFechaExpiracion(e.target.value)} className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900" />
            </div>
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1">Importe mínimo (€)</label>
              <input type="number" min="0" step="0.01" value={importeMinimo} onChange={(e) => setImporteMinimo(e.target.value)} placeholder="0" className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900" />
            </div>
          </div>
          <button
            onClick={handleCrear}
            disabled={pending || !codigo.trim() || !valor}
            className="mt-4 px-6 py-2.5 bg-green-600 text-white text-xs tracking-widest uppercase hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {pending ? "Creando..." : "Crear cupón"}
          </button>
        </div>
      )}

      {/* Lista de cupones */}
      {cupones.length === 0 ? (
        <div className="p-8 text-center text-neutral-400 text-sm">No hay cupones creados</div>
      ) : (
        <div className="bg-white border border-neutral-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Código</th>
                <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Descripción</th>
                <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Descuento</th>
                <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Usos</th>
                <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Expira</th>
                <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {cupones.map((c) => {
                const estado = estadoCupon(c);
                return (
                  <tr key={c.id} className={`hover:bg-neutral-50 transition-colors ${!c.activo ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-neutral-900">{c.codigo}</td>
                    <td className="px-4 py-3 text-neutral-600">{c.descripcion ?? "—"}</td>
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {c.tipo === "porcentaje" ? `${c.valor}%` : `${c.valor.toFixed(2)} €`}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {c.usos_actuales}{c.usos_maximos !== null ? ` / ${c.usos_maximos}` : ""}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                      {c.fecha_expiracion
                        ? new Date(c.fecha_expiracion).toLocaleDateString("es-ES")
                        : "Sin caducidad"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 font-medium ${estado.color}`}>{estado.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActivo(c)}
                          disabled={pending}
                          className={`text-xs px-2 py-1 transition-colors ${
                            c.activo
                              ? "text-amber-600 hover:bg-amber-50"
                              : "text-green-600 hover:bg-green-50"
                          }`}
                        >
                          {c.activo ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          onClick={() => handleEliminar(c.id)}
                          disabled={pending}
                          className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 transition-colors"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
