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
      variaciones:productos_variaciones(sku, precio_b2c)
    `)
    .gt("created_at", clearedAt)
    .order("created_at", { ascending: false });

  if (error) return { productos: [], clearedAt, error: error.message };

  const mapped = (productos ?? []).map((p: any) => ({
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
    precio_b2c: p.variaciones?.[0]?.precio_b2c ?? null,
    sku: p.variaciones?.[0]?.sku ?? null,
  }));

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
