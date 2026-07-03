"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// ─── Helper: verificar que el usuario es admin ────────────────────────────────
const ADMIN_EMAILS = ["ziarresamot@gmail.com"];

async function verificarAdmin() {
  // 1. Intentar con server client estándar
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && ADMIN_EMAILS.includes(user.email ?? "")) return user;
  } catch { /* ignorar */ }

  // 2. Fallback: leer JWT directamente desde cookie del browser client
  try {
    const cookieStore = await cookies();
    const projectRef = "yjanobsfzcwpusynvlun";
    const cookieName = `sb-${projectRef}-auth-token`;
    let tokenValue = cookieStore.get(cookieName)?.value;
    if (!tokenValue) {
      let combined = "";
      for (let i = 0; i < 5; i++) {
        const chunk = cookieStore.get(`${cookieName}.${i}`)?.value;
        if (!chunk) break;
        combined += chunk;
      }
      if (combined) tokenValue = combined;
    }
    if (tokenValue) {
      const parsed = JSON.parse(tokenValue);
      const accessToken: string = parsed.access_token;
      if (accessToken) {
        const payloadB64 = accessToken.split(".")[1];
        const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
        if (payload.sub && payload.exp * 1000 > Date.now() && ADMIN_EMAILS.includes(payload.email)) {
          return { id: payload.sub, email: payload.email };
        }
      }
    }
  } catch { /* ignorar */ }

  throw new Error("No autorizado");
}

// ─── Actualizar stock de una variación (llamado desde admin tabla inline) ─────
export async function actualizarStock(
  variacionId: string,
  nuevoStock: number
): Promise<{ ok: boolean; error?: string }> {
  if (nuevoStock < 0) return { ok: false, error: "El stock no puede ser negativo" };

  try {
    await verificarAdmin();
  } catch (e) {
    return { ok: false, error: "No autorizado" };
  }

  const supabase = createAdminClient();

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

  try {
    await verificarAdmin();
  } catch (e) {
    return { ok: false, error: "No autorizado" };
  }

  const supabase = createAdminClient();

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

  try {
    await verificarAdmin();
  } catch (e) {
    return { ok: false, actualizados: 0, errores: ["No autorizado"] };
  }

  const supabase = createAdminClient();
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
