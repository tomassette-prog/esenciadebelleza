"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import {
  crearCarrusel,
  actualizarCarrusel,
  toggleCarruselActivo,
  eliminarCarrusel,
  añadirProductoCarrusel,
  quitarProductoCarrusel,
  buscarProductosParaCarrusel,
} from "@/actions/carruseles";

type ProductoMin = {
  id: string;
  nombre: string;
  imagen_principal_url: string | null;
  marca: { nombre: string } | null | { nombre: string }[];
};

type CarruselProductoRow = {
  orden: number;
  producto: ProductoMin | null;
};

type Carrusel = {
  id: string;
  nombre: string;
  subtitulo: string | null;
  activo: boolean;
  orden: number;
  productos: CarruselProductoRow[];
};

type ProductoBusqueda = {
  id: string;
  nombre: string;
  marca: string | null;
  imagen_principal_url: string | null;
  enCarrusel: boolean;
};

export function CarruselesAdmin({ carruselesIniciales }: { carruselesIniciales: Carrusel[] }) {
  const [carruseles, setCarruseles] = useState<Carrusel[]>(carruselesIniciales);
  const [creando, setCreando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoSubtitulo, setNuevoSubtitulo] = useState("");
  const [isPending, startTransition] = useTransition();
  const [carruselAbierto, setCarruselAbierto] = useState<string | null>(null);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);

  const handleCrear = () => {
    if (!nuevoNombre.trim()) return;
    setErrorGlobal(null);
    startTransition(async () => {
      try {
        const res = await crearCarrusel(nuevoNombre.trim(), nuevoSubtitulo.trim());
        if (res.error) {
          setErrorGlobal(`Error al crear carrusel: ${res.error}. ¿Está ejecutada la migración SQL 010?`);
          return;
        }
        if (res.id) {
          setCarruseles((prev) => [
            ...prev,
            { id: res.id!, nombre: nuevoNombre.trim(), subtitulo: nuevoSubtitulo.trim() || null, activo: true, orden: prev.length, productos: [] },
          ]);
          setNuevoNombre("");
          setNuevoSubtitulo("");
          setCreando(false);
          setCarruselAbierto(res.id!);
        }
      } catch (e) {
        setErrorGlobal(`Error inesperado: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  };

  const handleToggleActivo = (id: string, activo: boolean) => {
    setCarruseles((prev) => prev.map((c) => (c.id === id ? { ...c, activo } : c)));
    startTransition(async () => { await toggleCarruselActivo(id, activo); });
  };

  const handleEliminar = (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el carrusel "${nombre}"? Se quitarán todos sus productos.`)) return;
    setCarruseles((prev) => prev.filter((c) => c.id !== id));
    startTransition(async () => { await eliminarCarrusel(id); });
  };

  return (
    <div className="space-y-4">
      {/* Error global */}
      {errorGlobal && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 flex items-start gap-3">
          <span className="shrink-0">⚠</span>
          <div className="flex-1">
            <p>{errorGlobal}</p>
            <p className="text-xs mt-1 text-red-500">
              Ve a Supabase → SQL Editor y ejecuta el contenido de{" "}
              <code className="bg-red-100 px-1">supabase/migrations/010_carruseles_custom.sql</code>
            </p>
          </div>
          <button onClick={() => setErrorGlobal(null)} className="text-red-400 hover:text-red-700">✕</button>
        </div>
      )}
      {/* Botón crear */}
      {!creando ? (
        <button
          onClick={() => setCreando(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm tracking-widest uppercase border border-neutral-300 hover:border-neutral-700 text-neutral-700 transition-colors"
        >
          + Nuevo carrusel
        </button>
      ) : (
        <div className="bg-white border border-neutral-200 p-5 space-y-3 max-w-lg">
          <p className="text-sm font-medium text-neutral-800">Nuevo carrusel</p>
          <input
            autoFocus
            type="text"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            placeholder="Nombre del carrusel (ej: Champús anticaída)"
            className="w-full px-3 py-2 border border-neutral-200 text-sm focus:outline-none focus:border-neutral-400"
            onKeyDown={(e) => e.key === "Enter" && handleCrear()}
          />
          <input
            type="text"
            value={nuevoSubtitulo}
            onChange={(e) => setNuevoSubtitulo(e.target.value)}
            placeholder="Subtítulo opcional (ej: Tratamientos especializados)"
            className="w-full px-3 py-2 border border-neutral-200 text-sm focus:outline-none focus:border-neutral-400"
            onKeyDown={(e) => e.key === "Enter" && handleCrear()}
          />
          <div className="flex gap-2">
            <button
              onClick={handleCrear}
              disabled={isPending || !nuevoNombre.trim()}
              className="px-4 py-2 text-sm bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? "Creando…" : "Crear"}
            </button>
            <button onClick={() => { setCreando(false); setNuevoNombre(""); setNuevoSubtitulo(""); }} className="px-4 py-2 text-sm border border-neutral-300 hover:border-neutral-600 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de carruseles */}
      {carruseles.length === 0 && !creando && (
        <p className="text-sm text-neutral-400 py-8 text-center">No hay carruseles. Crea el primero.</p>
      )}

      {carruseles.map((c) => (
        <CarruselPanel
          key={c.id}
          carrusel={c}
          abierto={carruselAbierto === c.id}
          onToggleAbrir={() => setCarruselAbierto(carruselAbierto === c.id ? null : c.id)}
          onToggleActivo={(activo) => handleToggleActivo(c.id, activo)}
          onEliminar={() => handleEliminar(c.id, c.nombre)}
          onUpdate={(nombre, subtitulo) =>
            setCarruseles((prev) => prev.map((x) => x.id === c.id ? { ...x, nombre, subtitulo } : x))
          }
          onProductosChange={(productos) =>
            setCarruseles((prev) => prev.map((x) => x.id === c.id ? { ...x, productos } : x))
          }
        />
      ))}
    </div>
  );
}

function CarruselPanel({
  carrusel,
  abierto,
  onToggleAbrir,
  onToggleActivo,
  onEliminar,
  onUpdate,
  onProductosChange,
}: {
  carrusel: Carrusel;
  abierto: boolean;
  onToggleAbrir: () => void;
  onToggleActivo: (v: boolean) => void;
  onEliminar: () => void;
  onUpdate: (nombre: string, subtitulo: string | null) => void;
  onProductosChange: (productos: CarruselProductoRow[]) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(carrusel.nombre);
  const [subtitulo, setSubtitulo] = useState(carrusel.subtitulo ?? "");
  const [, startTransition] = useTransition();

  const productosOrdenados = [...carrusel.productos]
    .sort((a, b) => a.orden - b.orden)
    .filter((r) => r.producto);

  const handleGuardar = () => {
    startTransition(async () => {
      await actualizarCarrusel(carrusel.id, nombre.trim(), subtitulo.trim());
      onUpdate(nombre.trim(), subtitulo.trim() || null);
      setEditando(false);
    });
  };

  const handleQuitarProducto = (productoId: string) => {
    onProductosChange(carrusel.productos.filter((r) => r.producto?.id !== productoId));
    startTransition(async () => { await quitarProductoCarrusel(carrusel.id, productoId); });
  };

  return (
    <div className={`bg-white border ${abierto ? "border-neutral-400" : "border-neutral-200"} transition-colors`}>
      {/* Cabecera */}
      <div className="flex items-center gap-3 px-5 py-4">
        <button onClick={onToggleAbrir} className="flex-1 flex items-center gap-3 text-left">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
            className={`w-4 h-4 text-neutral-400 transition-transform ${abierto ? "rotate-90" : ""}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <div>
            <span className="font-medium text-neutral-900 text-sm">{carrusel.nombre}</span>
            {carrusel.subtitulo && <span className="text-xs text-neutral-400 ml-2">{carrusel.subtitulo}</span>}
            <span className="text-xs text-neutral-400 ml-3">{productosOrdenados.length} producto{productosOrdenados.length !== 1 ? "s" : ""}</span>
          </div>
        </button>
        {/* Toggle activo */}
        <button
          onClick={() => onToggleActivo(!carrusel.activo)}
          className={`px-3 py-1 text-xs border transition-colors ${carrusel.activo ? "bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200" : "bg-neutral-100 text-neutral-500 border-neutral-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200"}`}
        >
          {carrusel.activo ? "Visible" : "Oculto"}
        </button>
        <button onClick={() => setEditando(!editando)} className="text-xs text-neutral-500 hover:text-neutral-900 underline underline-offset-2 transition-colors">
          Renombrar
        </button>
        <button onClick={onEliminar} className="text-xs text-red-400 hover:text-red-600 transition-colors" title="Eliminar carrusel">
          ✕
        </button>
      </div>

      {/* Editar nombre */}
      {editando && (
        <div className="px-5 pb-4 flex flex-wrap gap-2 items-center border-t border-neutral-100 pt-4">
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="px-3 py-1.5 border border-neutral-200 text-sm focus:outline-none focus:border-neutral-400 min-w-48"
            placeholder="Nombre"
          />
          <input
            value={subtitulo}
            onChange={(e) => setSubtitulo(e.target.value)}
            className="px-3 py-1.5 border border-neutral-200 text-sm focus:outline-none focus:border-neutral-400 min-w-48"
            placeholder="Subtítulo (opcional)"
          />
          <button onClick={handleGuardar} className="px-3 py-1.5 text-sm bg-neutral-900 text-white">Guardar</button>
          <button onClick={() => { setEditando(false); setNombre(carrusel.nombre); setSubtitulo(carrusel.subtitulo ?? ""); }} className="px-3 py-1.5 text-sm border border-neutral-300">Cancelar</button>
        </div>
      )}

      {/* Panel expandido */}
      {abierto && (
        <div className="border-t border-neutral-100 px-5 py-5 space-y-5">
          {/* Productos actuales */}
          {productosOrdenados.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-neutral-400 mb-3">Productos en este carrusel</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                {productosOrdenados.map(({ producto }) => {
                  if (!producto) return null;
                  const marca = (Array.isArray(producto.marca) ? producto.marca[0] : producto.marca as { nombre: string } | null)?.nombre;
                  return (
                    <div key={producto.id} className="relative group border border-neutral-100 p-2 bg-neutral-50 flex flex-col items-center gap-1">
                      {producto.imagen_principal_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={producto.imagen_principal_url} alt={producto.nombre} className="w-14 h-14 object-contain" loading="lazy" />
                      ) : (
                        <div className="w-14 h-14 bg-neutral-200" />
                      )}
                      <p className="text-[10px] text-neutral-700 text-center line-clamp-2 leading-tight">{producto.nombre}</p>
                      {marca && <p className="text-[10px] text-neutral-400">{marca}</p>}
                      <button
                        onClick={() => handleQuitarProducto(producto.id)}
                        className="absolute top-1 right-1 w-5 h-5 bg-white border border-neutral-200 text-neutral-400 hover:text-red-500 hover:border-red-300 text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        title="Quitar"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Buscador para añadir */}
          <BuscadorProductos
            carruselId={carrusel.id}
            onAñadir={(prod) => {
              const nuevo: CarruselProductoRow = {
                orden: carrusel.productos.length,
                producto: { id: prod.id, nombre: prod.nombre, imagen_principal_url: prod.imagen_principal_url, marca: prod.marca ? { nombre: prod.marca } : null },
              };
              onProductosChange([...carrusel.productos, nuevo]);
            }}
            onQuitar={(id) => onProductosChange(carrusel.productos.filter((r) => r.producto?.id !== id))}
            idsEnCarrusel={new Set(productosOrdenados.map((r) => r.producto!.id))}
          />
        </div>
      )}
    </div>
  );
}

function BuscadorProductos({
  carruselId,
  onAñadir,
  onQuitar,
  idsEnCarrusel,
}: {
  carruselId: string;
  onAñadir: (p: ProductoBusqueda) => void;
  onQuitar: (id: string) => void;
  idsEnCarrusel: Set<string>;
}) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ProductoBusqueda[]>([]);
  const [buscando, startBuscar] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscar = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startBuscar(async () => {
        const res = await buscarProductosParaCarrusel(q, carruselId);
        setResultados(res);
      });
    }, 300);
  }, [carruselId]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    buscar(e.target.value);
  };

  const [, startAction] = useTransition();

  const toggle = (prod: ProductoBusqueda) => {
    if (prod.enCarrusel || idsEnCarrusel.has(prod.id)) {
      onQuitar(prod.id);
      setResultados((r) => r.map((p) => p.id === prod.id ? { ...p, enCarrusel: false } : p));
      startAction(async () => { await quitarProductoCarrusel(carruselId, prod.id); });
    } else {
      onAñadir(prod);
      setResultados((r) => r.map((p) => p.id === prod.id ? { ...p, enCarrusel: true } : p));
      startAction(async () => { await añadirProductoCarrusel(carruselId, prod.id); });
    }
  };

  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-neutral-400 mb-3">Añadir productos</p>
      <div className="relative mb-3 max-w-md">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleInput}
          placeholder="Buscar producto por nombre…"
          className="w-full pl-9 pr-4 py-2 border border-neutral-200 text-sm focus:outline-none focus:border-neutral-400"
        />
        {buscando && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 animate-pulse">…</span>}
      </div>

      {resultados.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 max-h-72 overflow-y-auto pr-1">
          {resultados.map((prod) => {
            const yaEsta = prod.enCarrusel || idsEnCarrusel.has(prod.id);
            return (
              <button
                key={prod.id}
                onClick={() => toggle(prod)}
                className={`relative border p-2 flex flex-col items-center gap-1 text-left transition-all ${yaEsta ? "border-green-300 bg-green-50" : "border-neutral-100 bg-white hover:border-neutral-300"}`}
              >
                {yaEsta && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-green-500 text-white text-[10px] flex items-center justify-center rounded-full">✓</span>
                )}
                {prod.imagen_principal_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={prod.imagen_principal_url} alt={prod.nombre} className="w-14 h-14 object-contain" loading="lazy" />
                ) : (
                  <div className="w-14 h-14 bg-neutral-100" />
                )}
                <p className="text-[10px] text-neutral-700 text-center line-clamp-2 leading-tight w-full">{prod.nombre}</p>
                {prod.marca && <p className="text-[10px] text-neutral-400">{prod.marca}</p>}
              </button>
            );
          })}
        </div>
      )}

      {resultados.length === 0 && query && !buscando && (
        <p className="text-xs text-neutral-400">No se encontraron productos.</p>
      )}
      {resultados.length === 0 && !query && (
        <p className="text-xs text-neutral-400">Escribe para buscar productos.</p>
      )}
    </div>
  );
}
