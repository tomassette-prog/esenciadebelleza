"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ─── Actualizar stock de una variación (llamado desde admin tabla inline) ─────
export async function actualizarStock(
  variacionId: string,
  nuevoStock: number
): Promise<{ ok: boolean; error?: string }> {
  if (nuevoStock < 0) return { ok: false, error: "El stock no puede ser negativo" };

  const supabase = await createClient();

  // Verificar rol admin antes de cualquier escritura
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { ok: false, error: "No autorizado" };
  }

  const { error } = await supabase
    .from("productos_variaciones")
    .update({ stock: nuevoStock })
    .eq("id", variacionId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/stock");
  return { ok: true };
}

// ─── Actualizar precio B2C de una variación ───────────────────────────────────
export async function actualizarPrecio(
  variacionId: string,
  campo: "precio_b2c" | "precio_b2b" | "precio_comparar",
  valor: number
): Promise<{ ok: boolean; error?: string }> {
  if (valor < 0) return { ok: false, error: "El precio no puede ser negativo" };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { ok: false, error: "No autorizado" };
  }

  const { error } = await supabase
    .from("productos_variaciones")
    .update({ [campo]: valor })
    .eq("id", variacionId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/stock");
  return { ok: true };
}

// ─── UPSERT masivo desde CSV ──────────────────────────────────────────────────
export async function importarStockCsv(
  filas: { sku: string; stock: number; ubicacion_almacen?: string }[]
): Promise<{ ok: boolean; actualizados: number; errores: string[] }> {
  if (!filas.length) return { ok: true, actualizados: 0, errores: [] };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { ok: false, actualizados: 0, errores: ["No autorizado"] };
  }

  const errores: string[] = [];
  let actualizados = 0;

  // Batch UPSERT — una sola consulta
  const updates = filas.map((f) => ({
    sku: f.sku,
    stock: Math.max(0, f.stock),
    ...(f.ubicacion_almacen ? { ubicacion_almacen: f.ubicacion_almacen } : {}),
  }));

  const { error, count } = await supabase
    .from("productos_variaciones")
    .upsert(updates, { onConflict: "sku", ignoreDuplicates: false })
    .select("id");

  if (error) {
    errores.push(error.message);
  } else {
    actualizados = count ?? updates.length;
  }

  revalidatePath("/admin/stock");

  return { ok: errores.length === 0, actualizados, errores };
}
