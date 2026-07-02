"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface LineaCarrito {
  variacion_id: string;
  producto_id:  string;
  slug:         string;
  categoria:    string;
  subcategoria: string;
  nombre:       string;       // nombre padre + variación
  nombre_variacion: string;
  imagen_url:   string | null;
  precio:       number;       // precio vigente (b2c o b2b)
  cantidad:     number;
  sku:          string;
}

export interface LineaPack {
  pack_id:   string;
  slug:      string;
  nombre:    string;
  imagen_url: string | null;
  precio:    number;
  cantidad:  number;
  // Componentes para descontar stock en checkout
  items: { variacion_id: string; sku: string; cantidad: number }[];
}

interface EstadoCarrito {
  lineas:      LineaCarrito[];
  packs:       LineaPack[];
  abierto:     boolean;
}

type AccionCarrito =
  | { type: "AGREGAR";      payload: Omit<LineaCarrito, "cantidad"> & { cantidad?: number } }
  | { type: "QUITAR";       variacion_id: string }
  | { type: "CAMBIAR";      variacion_id: string; cantidad: number }
  | { type: "AGREGAR_PACK"; payload: Omit<LineaPack, "cantidad"> & { cantidad?: number } }
  | { type: "QUITAR_PACK";  pack_id: string }
  | { type: "CAMBIAR_PACK"; pack_id: string; cantidad: number }
  | { type: "VACIAR" }
  | { type: "ABRIR_DRAWER" }
  | { type: "CERRAR_DRAWER" }
  | { type: "HIDRATAR";     payload: LineaCarrito[]; packs?: LineaPack[] };

// ── Reducer ───────────────────────────────────────────────────────────────────
function reducer(state: EstadoCarrito, accion: AccionCarrito): EstadoCarrito {
  switch (accion.type) {
    case "HIDRATAR":
      return { ...state, lineas: accion.payload, packs: accion.packs ?? [] };

    case "AGREGAR": {
      const { cantidad = 1, ...item } = accion.payload;
      const idx = state.lineas.findIndex((l) => l.variacion_id === item.variacion_id);
      const lineas = idx >= 0
        ? state.lineas.map((l, i) =>
            i === idx ? { ...l, cantidad: l.cantidad + cantidad } : l
          )
        : [...state.lineas, { ...item, cantidad }];
      return { ...state, lineas, abierto: true };
    }

    case "QUITAR":
      return { ...state, lineas: state.lineas.filter((l) => l.variacion_id !== accion.variacion_id) };

    case "CAMBIAR": {
      if (accion.cantidad <= 0)
        return { ...state, lineas: state.lineas.filter((l) => l.variacion_id !== accion.variacion_id) };
      return {
        ...state,
        lineas: state.lineas.map((l) =>
          l.variacion_id === accion.variacion_id ? { ...l, cantidad: accion.cantidad } : l
        ),
      };
    }

    case "AGREGAR_PACK": {
      const { cantidad = 1, ...pack } = accion.payload;
      const idx = state.packs.findIndex((p) => p.pack_id === pack.pack_id);
      const packs = idx >= 0
        ? state.packs.map((p, i) => i === idx ? { ...p, cantidad: p.cantidad + cantidad } : p)
        : [...state.packs, { ...pack, cantidad }];
      return { ...state, packs, abierto: true };
    }

    case "QUITAR_PACK":
      return { ...state, packs: state.packs.filter((p) => p.pack_id !== accion.pack_id) };

    case "CAMBIAR_PACK": {
      if (accion.cantidad <= 0)
        return { ...state, packs: state.packs.filter((p) => p.pack_id !== accion.pack_id) };
      return {
        ...state,
        packs: state.packs.map((p) =>
          p.pack_id === accion.pack_id ? { ...p, cantidad: accion.cantidad } : p
        ),
      };
    }

    case "VACIAR":
      return { ...state, lineas: [], packs: [] };

    case "ABRIR_DRAWER":
      return { ...state, abierto: true };

    case "CERRAR_DRAWER":
      return { ...state, abierto: false };

    default:
      return state;
  }
}

// ── Contexto ──────────────────────────────────────────────────────────────────
interface ContextoCarrito {
  lineas:      LineaCarrito[];
  packs:       LineaPack[];
  abierto:     boolean;
  totalUnidades: number;
  totalPrecio:   number;
  agregar:     (item: Omit<LineaCarrito, "cantidad"> & { cantidad?: number }) => void;
  quitar:      (variacion_id: string) => void;
  cambiarCantidad: (variacion_id: string, cantidad: number) => void;
  agregarPack: (pack: Omit<LineaPack, "cantidad"> & { cantidad?: number }) => void;
  quitarPack:  (pack_id: string) => void;
  cambiarCantidadPack: (pack_id: string, cantidad: number) => void;
  vaciar:      () => void;
  abrirDrawer: () => void;
  cerrarDrawer: () => void;
}

const CarritoContext = createContext<ContextoCarrito | null>(null);
const STORAGE_KEY      = "esencia_carrito_v1";
const STORAGE_KEY_PACK = "esencia_packs_v1";

export function CarritoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { lineas: [], packs: [], abierto: false });

  // Hidratación desde localStorage
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      const guardadoPacks = localStorage.getItem(STORAGE_KEY_PACK);
      const lineas: LineaCarrito[] = guardado ? JSON.parse(guardado) : [];
      const packs: LineaPack[]     = guardadoPacks ? JSON.parse(guardadoPacks) : [];
      if (Array.isArray(lineas)) dispatch({ type: "HIDRATAR", payload: lineas, packs: Array.isArray(packs) ? packs : [] });
    } catch { /* localStorage corrupto */ }
  }, []);

  // Persistir en localStorage cuando cambian las líneas o packs
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.lineas)); } catch { /* cuota */ }
  }, [state.lineas]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_PACK, JSON.stringify(state.packs)); } catch { /* cuota */ }
  }, [state.packs]);

  const agregar     = useCallback((item: Omit<LineaCarrito, "cantidad"> & { cantidad?: number }) =>
    dispatch({ type: "AGREGAR", payload: item }), []);
  const quitar      = useCallback((variacion_id: string) =>
    dispatch({ type: "QUITAR", variacion_id }), []);
  const cambiarCantidad = useCallback((variacion_id: string, cantidad: number) =>
    dispatch({ type: "CAMBIAR", variacion_id, cantidad }), []);
  const agregarPack = useCallback((pack: Omit<LineaPack, "cantidad"> & { cantidad?: number }) =>
    dispatch({ type: "AGREGAR_PACK", payload: pack }), []);
  const quitarPack  = useCallback((pack_id: string) =>
    dispatch({ type: "QUITAR_PACK", pack_id }), []);
  const cambiarCantidadPack = useCallback((pack_id: string, cantidad: number) =>
    dispatch({ type: "CAMBIAR_PACK", pack_id, cantidad }), []);
  const vaciar      = useCallback(() => dispatch({ type: "VACIAR" }), []);
  const abrirDrawer = useCallback(() => dispatch({ type: "ABRIR_DRAWER" }), []);
  const cerrarDrawer = useCallback(() => dispatch({ type: "CERRAR_DRAWER" }), []);

  const totalUnidades = useMemo(
    () => state.lineas.reduce((acc, l) => acc + l.cantidad, 0)
        + state.packs.reduce((acc, p) => acc + p.cantidad, 0),
    [state.lineas, state.packs]
  );

  const totalPrecio = useMemo(
    () => state.lineas.reduce((acc, l) => acc + l.precio * l.cantidad, 0)
        + state.packs.reduce((acc, p) => acc + p.precio * p.cantidad, 0),
    [state.lineas, state.packs]
  );

  const value = useMemo<ContextoCarrito>(
    () => ({
      lineas: state.lineas,
      packs:  state.packs,
      abierto: state.abierto,
      totalUnidades,
      totalPrecio,
      agregar,
      quitar,
      cambiarCantidad,
      agregarPack,
      quitarPack,
      cambiarCantidadPack,
      vaciar,
      abrirDrawer,
      cerrarDrawer,
    }),
    [state, totalUnidades, totalPrecio, agregar, quitar, cambiarCantidad, agregarPack, quitarPack, cambiarCantidadPack, vaciar, abrirDrawer, cerrarDrawer]
  );

  return (
    <CarritoContext.Provider value={value}>
      {children}
    </CarritoContext.Provider>
  );
}

export function useCarrito(): ContextoCarrito {
  const ctx = useContext(CarritoContext);
  if (!ctx) throw new Error("useCarrito debe usarse dentro de <CarritoProvider>");
  return ctx;
}
