"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { crearPack, actualizarPack, eliminarPack } from "@/actions/packs";
import type { PackRegaloCompleto } from "@/types/producto";

interface VariacionBuscada {
  id: string;
  sku: string;
  nombre_variacion: string;
  precio_b2c: number;
  stock: number;
  imagen_url: string | null;
  producto_padre: { nombre: string; slug: string } | null;
}

interface ItemForm {
  variacion_id: string;
  cantidad: number;
  variacion: VariacionBuscada;
}

interface Props {
  pack?: PackRegaloCompleto;
}

export function PackForm({ pack }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  // Campos del pack
  const [nombre, setNombre]             = useState(pack?.nombre ?? "");
  const [slug, setSlug]                 = useState(pack?.slug ?? "");
  const [descripcion, setDescripcion]   = useState(pack?.descripcion ?? "");
  const [imagenUrl, setImagenUrl]       = useState(pack?.imagen_url ?? "");
  const [precioPack, setPrecioPack]     = useState(String(pack?.precio_pack ?? ""));
  const [precioOriginal, setPrecioOriginal] = useState(String(pack?.precio_original ?? ""));
  const [activo, setActivo]             = useState(pack?.activo ?? true);
  const [destacado, setDestacado]       = useState(pack?.destacado ?? false);
  const [orden, setOrden]               = useState(String(pack?.orden ?? 0));

  // Items
  const [items, setItems] = useState<ItemForm[]>(
    (pack?.items ?? []).map((item) => ({
      variacion_id: item.variacion_id,
      cantidad: item.cantidad,
      variacion: item.variacion as unknown as VariacionBuscada,
    }))
  );

  // Búsqueda de variaciones
  const [busqueda, setBusqueda]           = useState("");
  const [resultados, setResultados]       = useState<VariacionBuscada[]>([]);
  const [buscando, setBuscando]           = useState(false);

  const autoSlug = (nombre: string) =>
    nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleNombre = (v: string) => {
    setNombre(v);
    if (!pack) setSlug(autoSlug(v));
  };

  const buscarVariaciones = useCallback(async (q: string) => {
    if (q.length < 2) { setResultados([]); return; }
    setBuscando(true);
    try {
      const res = await fetch(`/api/variaciones/buscar?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResultados(data);
    } finally {
      setBuscando(false);
    }
  }, []);

  const handleBusqueda = (v: string) => {
    setBusqueda(v);
    const t = setTimeout(() => buscarVariaciones(v), 350);
    return () => clearTimeout(t);
  };

  const agregarItem = (v: VariacionBuscada) => {
    if (items.some((i) => i.variacion_id === v.id)) return;
    setItems((prev) => [...prev, { variacion_id: v.id, cantidad: 1, variacion: v }]);
    setBusqueda("");
    setResultados([]);
  };

  const quitarItem = (variacion_id: string) =>
    setItems((prev) => prev.filter((i) => i.variacion_id !== variacion_id));

  const cambiarCantidad = (variacion_id: string, cantidad: number) =>
    setItems((prev) =>
      prev.map((i) => (i.variacion_id === variacion_id ? { ...i, cantidad: Math.max(1, cantidad) } : i))
    );

  const handleGuardar = () => {
    setMsg(null);
    if (!nombre.trim()) { setMsg({ tipo: "error", texto: "El nombre es obligatorio" }); return; }
    if (!slug.trim()) { setMsg({ tipo: "error", texto: "El slug es obligatorio" }); return; }
    if (!precioPack || isNaN(Number(precioPack))) { setMsg({ tipo: "error", texto: "Precio del pack inválido" }); return; }
    if (!items.length) { setMsg({ tipo: "error", texto: "Añade al menos un producto al pack" }); return; }

    const payload = {
      slug: slug.trim(),
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || undefined,
      imagen_url: imagenUrl.trim() || undefined,
      precio_pack: Number(precioPack),
      precio_original: precioOriginal ? Number(precioOriginal) : undefined,
      activo,
      destacado,
      orden: Number(orden) || 0,
      items: items.map((i) => ({ variacion_id: i.variacion_id, cantidad: i.cantidad })),
    };

    startTransition(async () => {
      if (pack) {
        const { error } = await actualizarPack(pack.id, payload);
        if (error) { setMsg({ tipo: "error", texto: error }); return; }
        setMsg({ tipo: "ok", texto: "Pack actualizado" });
      } else {
        const { id, error } = await crearPack(payload);
        if (error || !id) { setMsg({ tipo: "error", texto: error ?? "Error" }); return; }
        router.push(`/admin/packs/${id}`);
      }
    });
  };

  const handleEliminar = () => {
    if (!pack || !confirm(`¿Eliminar el pack "${pack.nombre}"? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      const { error } = await eliminarPack(pack.id);
      if (error) { setMsg({ tipo: "error", texto: error }); return; }
      router.push("/admin/packs");
    });
  };

  const stockPack = items.length
    ? Math.min(...items.map((i) => Math.floor((i.variacion?.stock ?? 0) / i.cantidad)))
    : 0;

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Datos básicos */}
      <section className="bg-white border border-neutral-200 p-6 space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-500">Datos básicos</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs text-neutral-500 mb-1">Nombre del pack *</label>
            <input value={nombre} onChange={(e) => handleNombre(e.target.value)}
              className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-neutral-600" />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Slug (URL) *</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value)}
              className="w-full border border-neutral-300 px-3 py-2 text-sm font-mono focus:outline-none focus:border-neutral-600" />
            <p className="text-xs text-neutral-400 mt-1">/packs/{slug || "…"}</p>
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Orden</label>
            <input type="number" value={orden} onChange={(e) => setOrden(e.target.value)} min={0}
              className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-neutral-600" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-neutral-500 mb-1">Descripción</label>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3}
              className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-neutral-600 resize-none" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-neutral-500 mb-1">URL imagen</label>
            <input value={imagenUrl} onChange={(e) => setImagenUrl(e.target.value)} placeholder="https://…"
              className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-neutral-600" />
          </div>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="w-4 h-4 accent-neutral-900" />
            <span className="text-sm">Activo</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={destacado} onChange={(e) => setDestacado(e.target.checked)} className="w-4 h-4 accent-neutral-900" />
            <span className="text-sm">Destacado (aparece en home)</span>
          </label>
        </div>
      </section>

      {/* Precios */}
      <section className="bg-white border border-neutral-200 p-6 space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-500">Precios</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Precio del pack (€) *</label>
            <input type="number" step="0.01" min="0" value={precioPack} onChange={(e) => setPrecioPack(e.target.value)}
              className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-neutral-600" />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Precio sin pack / suma individual (€)</label>
            <input type="number" step="0.01" min="0" value={precioOriginal} onChange={(e) => setPrecioOriginal(e.target.value)}
              placeholder="Opcional"
              className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-neutral-600" />
          </div>
        </div>
        {precioOriginal && precioPack && Number(precioOriginal) > Number(precioPack) && (
          <p className="text-sm text-green-700">
            Ahorro: <strong>{(Number(precioOriginal) - Number(precioPack)).toFixed(2)} €</strong>{" "}
            ({Math.round((1 - Number(precioPack) / Number(precioOriginal)) * 100)}% descuento)
          </p>
        )}
      </section>

      {/* Productos del pack */}
      <section className="bg-white border border-neutral-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-500">Productos del pack</h2>
          {items.length > 0 && (
            <span className={`text-xs font-medium ${stockPack > 0 ? "text-green-700" : "text-red-500"}`}>
              Stock disponible: {stockPack > 0 ? `${stockPack} uds` : "Agotado"}
            </span>
          )}
        </div>

        {/* Buscador de variaciones */}
        <div className="relative">
          <input
            value={busqueda}
            onChange={(e) => handleBusqueda(e.target.value)}
            placeholder="Busca un producto por nombre o SKU…"
            className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
          />
          {buscando && <p className="absolute text-xs text-neutral-400 mt-1">Buscando…</p>}
          {resultados.length > 0 && (
            <div className="absolute z-20 left-0 right-0 bg-white border border-neutral-200 shadow-lg mt-0.5 max-h-64 overflow-y-auto">
              {resultados.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => agregarItem(v)}
                  disabled={items.some((i) => i.variacion_id === v.id)}
                  className="w-full text-left px-3 py-2.5 hover:bg-neutral-50 transition-colors border-b border-neutral-100 last:border-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <p className="text-sm font-medium text-neutral-900 line-clamp-1">
                    {v.producto_padre?.nombre} — {v.nombre_variacion}
                  </p>
                  <p className="text-xs text-neutral-400">
                    SKU: {v.sku} · {v.precio_b2c.toFixed(2)} € · Stock: {v.stock}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lista de items */}
        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.variacion_id} className="flex items-center gap-3 p-3 border border-neutral-100 bg-neutral-50">
                {item.variacion?.imagen_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.variacion.imagen_url} alt="" className="w-10 h-10 object-contain bg-white border border-neutral-100 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 line-clamp-1">
                    {item.variacion?.producto_padre?.nombre} — {item.variacion?.nombre_variacion}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {item.variacion?.precio_b2c.toFixed(2)} € · Stock: {item.variacion?.stock ?? 0}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <label className="text-xs text-neutral-500">Uds:</label>
                  <input
                    type="number"
                    min={1}
                    value={item.cantidad}
                    onChange={(e) => cambiarCantidad(item.variacion_id, parseInt(e.target.value, 10))}
                    className="w-16 border border-neutral-300 px-2 py-1 text-sm text-center focus:outline-none focus:border-neutral-600"
                  />
                </div>
                <button type="button" onClick={() => quitarItem(item.variacion_id)}
                  className="text-neutral-400 hover:text-red-500 transition-colors text-lg leading-none shrink-0">
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-400 text-center py-6 border border-dashed border-neutral-200">
            Busca y añade productos para componer el pack
          </p>
        )}
      </section>

      {/* Acciones */}
      {msg && (
        <p className={`text-sm ${msg.tipo === "ok" ? "text-green-700" : "text-red-600"}`}>{msg.texto}</p>
      )}
      <div className="flex items-center gap-4">
        <button
          onClick={handleGuardar}
          disabled={isPending}
          className="px-8 py-2.5 bg-[#3D2018] text-white text-xs tracking-widest uppercase hover:bg-neutral-900 disabled:opacity-40 transition-colors"
        >
          {isPending ? "Guardando…" : pack ? "Guardar cambios" : "Crear pack"}
        </button>
        <button onClick={() => router.push("/admin/packs")}
          className="text-sm text-neutral-400 hover:text-neutral-700 underline underline-offset-2">
          Cancelar
        </button>
        {pack && (
          <button onClick={handleEliminar} disabled={isPending}
            className="ml-auto text-xs text-red-500 hover:text-red-700 underline underline-offset-2 transition-colors">
            Eliminar pack
          </button>
        )}
      </div>
    </div>
  );
}
