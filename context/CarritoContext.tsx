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

interface EstadoCarrito {
  lineas:   LineaCarrito[];
  abierto:  boolean;
}

type AccionCarrito =
  | { type: "AGREGAR";    payload: Omit<LineaCarrito, "cantidad"> & { cantidad?: number } }
  | { type: "QUITAR";     variacion_id: string }
  | { type: "CAMBIAR";    variacion_id: string; cantidad: number }
  | { type: "VACIAR" }
  | { type: "ABRIR_DRAWER" }
  | { type: "CERRAR_DRAWER" }
  | { type: "HIDRATAR";   payload: LineaCarrito[] };

// ── Reducer ───────────────────────────────────────────────────────────────────
function reducer(state: EstadoCarrito, accion: AccionCarrito): EstadoCarrito {
  switch (accion.type) {
    case "HIDRATAR":
      return { ...state, lineas: accion.payload };

    case "AGREGAR": {
      const { cantidad = 1, ...item } = accion.payload;
      const idx = state.lineas.findIndex((l) => l.variacion_id === item.variacion_id);
      const lineas = idx >= 0
        ? state.lineas.map((l, i) =>
            i === idx ? { ...l, cantidad: l.cantidad + cantidad } : l
          )
        : [...state.lineas, { ...item, cantidad }];
      return { lineas, abierto: true };
    }

    case "QUITAR":
      return {
        ...state,
        lineas: state.lineas.filter((l) => l.variacion_id !== accion.variacion_id),
      };

    case "CAMBIAR": {
      if (accion.cantidad <= 0) {
        return { ...state, lineas: state.lineas.filter((l) => l.variacion_id !== accion.variacion_id) };
      }
      return {
        ...state,
        lineas: state.lineas.map((l) =>
          l.variacion_id === accion.variacion_id ? { ...l, cantidad: accion.cantidad } : l
        ),
      };
    }

    case "VACIAR":
      return { ...state, lineas: [] };

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
  abierto:     boolean;
  totalUnidades: number;
  totalPrecio:   number;
  agregar:     (item: Omit<LineaCarrito, "cantidad"> & { cantidad?: number }) => void;
  quitar:      (variacion_id: string) => void;
  cambiarCantidad: (variacion_id: string, cantidad: number) => void;
  vaciar:      () => void;
  abrirDrawer: () => void;
  cerrarDrawer: () => void;
}

const CarritoContext = createContext<ContextoCarrito | null>(null);
const STORAGE_KEY = "esencia_carrito_v1";

export function CarritoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { lineas: [], abierto: false });

  // Hidratación desde localStorage
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado) {
        const lineas: LineaCarrito[] = JSON.parse(guardado);
        if (Array.isArray(lineas)) {
          dispatch({ type: "HIDRATAR", payload: lineas });
        }
      }
    } catch {
      // localStorage corrupto → ignorar
    }
  }, []);

  // Persistir en localStorage cuando cambian las líneas
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.lineas));
    } catch {
      // cuota excedida → ignorar
    }
  }, [state.lineas]);

  const agregar     = useCallback((item: Omit<LineaCarrito, "cantidad"> & { cantidad?: number }) =>
    dispatch({ type: "AGREGAR", payload: item }), []);
  const quitar      = useCallback((variacion_id: string) =>
    dispatch({ type: "QUITAR", variacion_id }), []);
  const cambiarCantidad = useCallback((variacion_id: string, cantidad: number) =>
    dispatch({ type: "CAMBIAR", variacion_id, cantidad }), []);
  const vaciar      = useCallback(() => dispatch({ type: "VACIAR" }), []);
  const abrirDrawer = useCallback(() => dispatch({ type: "ABRIR_DRAWER" }), []);
  const cerrarDrawer = useCallback(() => dispatch({ type: "CERRAR_DRAWER" }), []);

  const totalUnidades = useMemo(
    () => state.lineas.reduce((acc, l) => acc + l.cantidad, 0),
    [state.lineas]
  );

  const totalPrecio = useMemo(
    () => state.lineas.reduce((acc, l) => acc + l.precio * l.cantidad, 0),
    [state.lineas]
  );

  const value = useMemo<ContextoCarrito>(
    () => ({
      lineas: state.lineas,
      abierto: state.abierto,
      totalUnidades,
      totalPrecio,
      agregar,
      quitar,
      cambiarCantidad,
      vaciar,
      abrirDrawer,
      cerrarDrawer,
    }),
    [state, totalUnidades, totalPrecio, agregar, quitar, cambiarCantidad, vaciar, abrirDrawer, cerrarDrawer]
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
