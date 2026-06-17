import { createClient } from "@/lib/supabase/server";
import { StockTable } from "@/components/admin/StockTable";

export const dynamic = "force-dynamic"; // siempre datos frescos en admin

export default async function AdminStockPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("productos_variaciones")
    .select(`
      *,
      producto_padre:productos_padre (
        nombre,
        categoria
      )
    `)
    .eq("activa", true)
    .order("producto_padre_id")
    .order("nombre_variacion");

  if (error) {
    return (
      <div className="p-8 text-red-500">
        Error cargando variaciones: {error.message}
      </div>
    );
  }

  const filas = (data ?? []).map((v) => ({
    ...v,
    producto_nombre: v.producto_padre?.nombre ?? "—",
    categoria: v.producto_padre?.categoria ?? "—",
  }));

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-light text-neutral-900"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            Gestión de Stock
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Edita el stock y precios directamente en la tabla. Los cambios se
            guardan al pulsar{" "}
            <kbd className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-xs">
              Enter
            </kbd>{" "}
            o al salir de cada celda.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-light text-neutral-900">{filas.length}</p>
          <p className="text-xs text-neutral-400 uppercase tracking-widest">
            Variaciones
          </p>
        </div>
      </div>

      {/* Alertas de stock bajo */}
      {filas.filter((f) => f.stock < f.stock_minimo && f.stock > 0).length > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          {filas.filter((f) => f.stock < f.stock_minimo && f.stock > 0).length}{" "}
          referencias con stock bajo el mínimo
        </div>
      )}
      {filas.filter((f) => f.stock === 0).length > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {filas.filter((f) => f.stock === 0).length}{" "}
          referencias sin stock
        </div>
      )}

      {/* Formato del CSV de importación */}
      <details className="text-xs text-neutral-400 border border-neutral-100 p-3">
        <summary className="cursor-pointer font-medium text-neutral-600">
          Formato del CSV de importación
        </summary>
        <pre className="mt-2 bg-neutral-50 p-2 overflow-x-auto">
{`sku,stock,ubicacion_almacen
LOREAL-7.11-100ML,25,A-01-03
WELLA-8N-60ML,12,B-02-01`}
        </pre>
      </details>

      {/* Tabla */}
      <StockTable filas={filas} />
    </div>
  );
}
