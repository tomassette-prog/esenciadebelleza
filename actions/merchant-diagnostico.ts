"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export interface DiagnosticoProducto {
  id: string;
  nombre: string;
  slug: string;
  categoria: string;
  problemas: string[];
}

export async function diagnosticarProductosMerchant(): Promise<{
  total: number;
  sinVariaciones: DiagnosticoProducto[];
  sinPrecio: DiagnosticoProducto[];
  sinNombre: DiagnosticoProducto[];
  sinImagen: DiagnosticoProducto[];
}> {
  const supabase = createAdminClient();

  // Cargar todos los productos activos con variaciones
  let todos: Record<string, unknown>[] = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("productos_padre")
      .select(`
        id, nombre, slug, categoria, imagen_principal_url,
        variaciones:productos_variaciones(id, activa, stock, precio_b2c)
      `)
      .eq("activo", true)
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    todos = todos.concat(data);
    if (data.length < 1000) break;
    offset += 1000;
  }

  const sinVariaciones: DiagnosticoProducto[] = [];
  const sinPrecio: DiagnosticoProducto[] = [];
  const sinNombre: DiagnosticoProducto[] = [];
  const sinImagen: DiagnosticoProducto[] = [];

  for (const p of todos) {
    const problemas: string[] = [];
    const vars = (p.variaciones as { activa: boolean; precio_b2c: number; stock: number }[]) ?? [];
    const varsActivas = vars.filter((v) => v.activa);
    const nombre = (p.nombre as string) ?? "";

    // Sin variaciones activas → availability missing
    if (vars.length === 0 || varsActivas.length === 0) {
      problemas.push("availability");
      sinVariaciones.push({
        id: p.id as string,
        nombre,
        slug: p.slug as string,
        categoria: p.categoria as string,
        problemas: ["Sin variaciones activas"],
      });
    }

    // Variaciones activas sin precio → price missing
    if (
      varsActivas.length > 0 &&
      varsActivas.every((v) => !v.precio_b2c || v.precio_b2c <= 0)
    ) {
      problemas.push("price");
      sinPrecio.push({
        id: p.id as string,
        nombre,
        slug: p.slug as string,
        categoria: p.categoria as string,
        problemas: ["Variaciones sin precio"],
      });
    }

    // Nombre genérico o vacío
    if (!nombre || nombre.toLowerCase() === "unidad" || nombre.length < 3) {
      problemas.push("title");
      sinNombre.push({
        id: p.id as string,
        nombre: nombre || "(vacío)",
        slug: p.slug as string,
        categoria: p.categoria as string,
        problemas: ["Nombre genérico o vacío"],
      });
    }

    // Sin imagen
    if (!p.imagen_principal_url) {
      problemas.push("image");
      sinImagen.push({
        id: p.id as string,
        nombre,
        slug: p.slug as string,
        categoria: p.categoria as string,
        problemas: ["Sin imagen principal"],
      });
    }
  }

  return {
    total: todos.length,
    sinVariaciones,
    sinPrecio,
    sinNombre,
    sinImagen,
  };
}

export async function activarVariaciones(ids: string[]): Promise<{
  ok: boolean;
  actualizados: number;
  insertados: number;
  error?: string;
}> {
  if (!ids.length) return { ok: true, actualizados: 0, insertados: 0 };

  const supabase = createAdminClient();
  let totalUpdated = 0;
  let totalInserted = 0;

  // 1. Activar variaciones existentes pero inactivas QUE TENGAN PRECIO
  const { data: updated, error: updateError } = await supabase
    .from("productos_variaciones")
    .update({ activa: true })
    .in("producto_padre_id", ids)
    .eq("activa", false)
    .gt("precio_b2c", 0)
    .select("id");

  if (updateError) return { ok: false, actualizados: 0, insertados: 0, error: updateError.message };
  totalUpdated = updated?.length ?? 0;

  // 2. Para productos sin ninguna variación, insertar una por defecto
  const { data: existing } = await supabase
    .from("productos_variaciones")
    .select("producto_padre_id")
    .in("producto_padre_id", ids);

  const conVariacion = new Set((existing ?? []).map((r: { producto_padre_id: string }) => r.producto_padre_id));
  const sinVariacion = ids.filter((id) => !conVariacion.has(id));

  if (sinVariacion.length > 0) {
    const nuevas = sinVariacion.map((id) => ({
      producto_padre_id: id,
      sku: `VAR-${crypto.randomUUID().slice(0, 12)}`,
      nombre_variacion: "Unidad",
      activa: true,
      stock: 0,
      precio_b2c: 0.01,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("productos_variaciones")
      .insert(nuevas)
      .select("id");

    if (insertError) return { ok: false, actualizados: totalUpdated, insertados: 0, error: `Insert: ${insertError.message}` };
    totalInserted = inserted?.length ?? 0;
  }

  return { ok: true, actualizados: totalUpdated, insertados: totalInserted };
}

/**
 * Activa TODAS las variaciones que tengan precio > 0, sin importar el stock.
 * Útil para que aparezcan en Google Shopping aunque estén agotadas en WC.
 */
export async function activarTodasConPrecio(): Promise<{
  ok: boolean;
  activadas: number;
  error?: string;
}> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("productos_variaciones")
    .update({ activa: true })
    .eq("activa", false)
    .gt("precio_b2c", 0)
    .select("id");

  if (error) return { ok: false, activadas: 0, error: error.message };
  return { ok: true, activadas: data?.length ?? 0 };
}
