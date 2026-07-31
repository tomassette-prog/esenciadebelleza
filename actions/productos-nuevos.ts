"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAILS = ["ziarresamot@gmail.com"];

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function verificarAdmin() {
  try {
    const cookieStore = await cookies();
    const cookieName = `sb-yjanobsfzcwpusynvlun-auth-token`;
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
      const payload = JSON.parse(Buffer.from(parsed.access_token.split(".")[1], "base64url").toString());
      if (payload.sub && payload.exp * 1000 > Date.now() && ADMIN_EMAILS.includes(payload.email)) return;
    }
  } catch { /* ignorar */ }
  throw new Error("No autorizado");
}

/** Get the timestamp since which products are "new" */
async function getClearedAt(supa: ReturnType<typeof adminClient>): Promise<string> {
  const { data } = await supa
    .from("config_tienda")
    .select("valor")
    .eq("clave", "productos_nuevos_cleared_at")
    .single();
  // Default: 30 days ago if never cleared
  return data?.valor ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

export interface ProductoNuevo {
  id: string;
  nombre: string;
  slug: string;
  categoria: string;
  subcategoria: string | null;
  imagen_principal_url: string | null;
  woo_id: number | null;
  activo: boolean;
  created_at: string;
  marca_nombre: string | null;
  precio_b2c: number | null;
  sku: string | null;
}

export async function getProductosNuevos(): Promise<{ productos: ProductoNuevo[]; clearedAt: string; error?: string }> {
  try {
    await verificarAdmin();
  } catch {
    return { productos: [], clearedAt: "", error: "No autorizado" };
  }

  const supa = adminClient();
  const clearedAt = await getClearedAt(supa);

  const { data: productos, error } = await supa
    .from("productos_padre")
    .select(`
      id, nombre, slug, categoria, subcategoria, imagen_principal_url,
      woo_id, activo, created_at,
      marca:marcas(nombre),
      variaciones:productos_variaciones!inner(sku, precio_b2c, activa)
    `)
    .eq("variaciones.activa", true)
    .gt("created_at", clearedAt)
    .order("created_at", { ascending: false });

  if (error) return { productos: [], clearedAt, error: error.message };

  const mapped = (productos ?? []).map((p: any) => {
    // Preferir variación con precio válido más alto (evita precios dummy de 0.01)
    const vars: any[] = p.variaciones ?? [];
    const bestVar = vars
      .filter((v: any) => v.precio_b2c != null && v.precio_b2c > 0.1)
      .sort((a: any, b: any) => b.precio_b2c - a.precio_b2c)[0]
      ?? vars[0]
      ?? null;

    return {
      id: p.id,
      nombre: p.nombre,
      slug: p.slug,
      categoria: p.categoria,
      subcategoria: p.subcategoria,
      imagen_principal_url: p.imagen_principal_url,
      woo_id: p.woo_id,
      activo: p.activo,
      created_at: p.created_at,
      marca_nombre: p.marca?.nombre ?? null,
      precio_b2c: bestVar?.precio_b2c ?? null,
      sku: bestVar?.sku ?? null,
    };
  });

  return { productos: mapped, clearedAt };
}

export async function marcarNuevosVerificados(): Promise<{ ok: boolean; error?: string }> {
  try {
    await verificarAdmin();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const supa = adminClient();
  const now = new Date().toISOString();

  const { error } = await supa
    .from("config_tienda")
    .upsert(
      { clave: "productos_nuevos_cleared_at", valor: now },
      { onConflict: "clave" }
    );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function actualizarProductoNuevo(
  id: string,
  updates: { nombre?: string; categoria?: string; subcategoria?: string; activo?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  try {
    await verificarAdmin();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const supa = adminClient();
  const { error } = await supa.from("productos_padre").update(updates).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Delete a single product + its variations. Next import will re-create it correctly. */
export async function eliminarProducto(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await verificarAdmin();
  } catch {
    return { ok: false, error: "No autorizado" };
  }

  const supa = adminClient();
  // Delete variations first (no cascade assumed)
  await supa.from("productos_variaciones").delete().eq("producto_padre_id", id);
  const { error } = await supa.from("productos_padre").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Bulk delete products + their variations */
export async function eliminarProductos(ids: string[]): Promise<{ ok: number; error?: string }> {
  try {
    await verificarAdmin();
  } catch {
    return { ok: 0, error: "No autorizado" };
  }

  if (!ids.length) return { ok: 0 };

  const supa = adminClient();
  // Delete variations first
  for (const id of ids) {
    await supa.from("productos_variaciones").delete().eq("producto_padre_id", id);
  }
  const { error } = await supa.from("productos_padre").delete().in("id", ids);
  if (error) return { ok: 0, error: error.message };
  return { ok: ids.length };
}

/** Bulk update category/subcategory */
export async function bulkActualizarCategoria(
  ids: string[],
  categoria: string,
  subcategoria: string
): Promise<{ ok: number; error?: string }> {
  try {
    await verificarAdmin();
  } catch {
    return { ok: 0, error: "No autorizado" };
  }

  if (!ids.length) return { ok: 0 };

  const supa = adminClient();
  const { error } = await supa.from("productos_padre")
    .update({ categoria, subcategoria })
    .in("id", ids);
  if (error) return { ok: 0, error: error.message };
  return { ok: ids.length };
}

/** Bulk update brand (marca_id) */
export async function bulkActualizarMarca(
  ids: string[],
  marcaId: string | null
): Promise<{ ok: number; error?: string }> {
  try {
    await verificarAdmin();
  } catch {
    return { ok: 0, error: "No autorizado" };
  }

  if (!ids.length) return { ok: 0 };

  const supa = adminClient();
  const { error } = await supa.from("productos_padre")
    .update({ marca_id: marcaId })
    .in("id", ids);
  if (error) return { ok: 0, error: error.message };
  return { ok: ids.length };
}

/** Bulk toggle active state */
export async function bulkToggleActivo(
  ids: string[],
  activo: boolean
): Promise<{ ok: number; error?: string }> {
  try {
    await verificarAdmin();
  } catch {
    return { ok: 0, error: "No autorizado" };
  }

  if (!ids.length) return { ok: 0 };

  const supa = adminClient();
  const { error } = await supa.from("productos_padre")
    .update({ activo })
    .in("id", ids);
  if (error) return { ok: 0, error: error.message };
  return { ok: ids.length };
}

/** List all brands for bulk assignment */
export async function listarMarcasParaSelect(): Promise<{ marcas: Array<{ id: string; nombre: string }>; error?: string }> {
  try {
    await verificarAdmin();
  } catch {
    return { marcas: [], error: "No autorizado" };
  }

  const supa = adminClient();
  const { data, error } = await supa.from("marcas").select("id, nombre").order("nombre");
  if (error) return { marcas: [], error: error.message };
  return { marcas: data ?? [] };
}
