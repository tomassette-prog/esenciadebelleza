"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { PackRegaloCompleto, PackRegaloItem } from "@/types/producto";

const ADMIN_EMAILS = ["ziarresamot@gmail.com"];

async function verificarAdmin() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && ADMIN_EMAILS.includes(user.email ?? "")) return user;
  } catch { /* ignorar */ }
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
        const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
        if (ADMIN_EMAILS.includes(payload.email ?? "")) return payload;
      }
    }
  } catch { /* ignorar */ }
  throw new Error("No autorizado");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcularStock(items: PackRegaloItem[]): number {
  if (!items.length) return 0;
  return Math.min(
    ...items.map((item) => {
      const stock = item.variacion?.stock ?? 0;
      return Math.floor(stock / item.cantidad);
    })
  );
}

// ── Lectura pública ───────────────────────────────────────────────────────────

export async function getPacksDestacados(): Promise<PackRegaloCompleto[]> {
  const supabase = createAdminClient();
  const { data: packs } = await supabase
    .from("packs_regalo")
    .select("*")
    .eq("activo", true)
    .eq("destacado", true)
    .order("orden");

  if (!packs?.length) return [];
  return hydratarPacks(packs, supabase);
}

export async function getPacksActivos(): Promise<PackRegaloCompleto[]> {
  const supabase = createAdminClient();
  const { data: packs } = await supabase
    .from("packs_regalo")
    .select("*")
    .eq("activo", true)
    .order("orden");

  if (!packs?.length) return [];
  return hydratarPacks(packs, supabase);
}

export async function getPackBySlug(slug: string): Promise<PackRegaloCompleto | null> {
  const supabase = createAdminClient();
  const { data: pack } = await supabase
    .from("packs_regalo")
    .select("*")
    .eq("slug", slug)
    .eq("activo", true)
    .single();

  if (!pack) return null;
  const [completo] = await hydratarPacks([pack], supabase);
  return completo ?? null;
}

// ── Admin: lectura ─────────────────────────────────────────────────────────────

export async function getPacksAdmin(): Promise<PackRegaloCompleto[]> {
  await verificarAdmin();
  const supabase = createAdminClient();
  const { data: packs } = await supabase
    .from("packs_regalo")
    .select("*")
    .order("orden");

  if (!packs?.length) return [];
  return hydratarPacks(packs, supabase);
}

export async function getPackAdminById(id: string): Promise<PackRegaloCompleto | null> {
  await verificarAdmin();
  const supabase = createAdminClient();
  const { data: pack } = await supabase
    .from("packs_regalo")
    .select("*")
    .eq("id", id)
    .single();

  if (!pack) return null;
  const [completo] = await hydratarPacks([pack], supabase);
  return completo ?? null;
}

// ── Admin: escritura ──────────────────────────────────────────────────────────

export async function crearPack(data: {
  slug: string;
  nombre: string;
  descripcion?: string;
  imagen_url?: string;
  precio_pack: number;
  precio_original?: number;
  activo: boolean;
  destacado: boolean;
  orden: number;
  items: { variacion_id: string; cantidad: number }[];
}): Promise<{ id: string | null; error: string | null }> {
  await verificarAdmin();
  const supabase = createAdminClient();

  const { data: pack, error } = await supabase
    .from("packs_regalo")
    .insert({
      slug:            data.slug,
      nombre:          data.nombre,
      descripcion:     data.descripcion ?? null,
      imagen_url:      data.imagen_url ?? null,
      precio_pack:     data.precio_pack,
      precio_original: data.precio_original ?? null,
      activo:          data.activo,
      destacado:       data.destacado,
      orden:           data.orden,
    })
    .select("id")
    .single();

  if (error || !pack) return { id: null, error: error?.message ?? "Error al crear el pack" };

  if (data.items.length) {
    const { error: errItems } = await supabase.from("packs_regalo_items").insert(
      data.items.map((i) => ({ pack_id: pack.id, variacion_id: i.variacion_id, cantidad: i.cantidad }))
    );
    if (errItems) return { id: null, error: errItems.message };
  }

  revalidatePath("/admin/packs");
  revalidatePath("/packs");
  return { id: pack.id, error: null };
}

export async function actualizarPack(
  id: string,
  data: {
    slug: string;
    nombre: string;
    descripcion?: string;
    imagen_url?: string;
    precio_pack: number;
    precio_original?: number;
    activo: boolean;
    destacado: boolean;
    orden: number;
    items: { variacion_id: string; cantidad: number }[];
  }
): Promise<{ error: string | null }> {
  await verificarAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("packs_regalo")
    .update({
      slug:            data.slug,
      nombre:          data.nombre,
      descripcion:     data.descripcion ?? null,
      imagen_url:      data.imagen_url ?? null,
      precio_pack:     data.precio_pack,
      precio_original: data.precio_original ?? null,
      activo:          data.activo,
      destacado:       data.destacado,
      orden:           data.orden,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  // Reemplazar items
  await supabase.from("packs_regalo_items").delete().eq("pack_id", id);
  if (data.items.length) {
    const { error: errItems } = await supabase.from("packs_regalo_items").insert(
      data.items.map((i) => ({ pack_id: id, variacion_id: i.variacion_id, cantidad: i.cantidad }))
    );
    if (errItems) return { error: errItems.message };
  }

  revalidatePath("/admin/packs");
  revalidatePath(`/admin/packs/${id}`);
  revalidatePath("/packs");
  revalidatePath(`/packs/${data.slug}`);
  return { error: null };
}

export async function eliminarPack(id: string): Promise<{ error: string | null }> {
  await verificarAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("packs_regalo").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/packs");
  revalidatePath("/packs");
  return { error: null };
}

// ── Interno: hidratar items + stock ──────────────────────────────────────────

async function hydratarPacks(
  packs: Record<string, unknown>[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<PackRegaloCompleto[]> {
  const packIds = packs.map((p) => p.id as string);

  const { data: rawItems } = await supabase
    .from("packs_regalo_items")
    .select(`
      id, pack_id, variacion_id, cantidad,
      variacion:productos_variaciones(
        id, sku, nombre_variacion, precio_b2c, stock, imagen_url,
        producto_padre:productos_padre(id, nombre, slug, categoria, subcategoria)
      )
    `)
    .in("pack_id", packIds);

  const itemsByPack = new Map<string, PackRegaloItem[]>();
  for (const item of (rawItems ?? []) as PackRegaloItem[]) {
    const arr = itemsByPack.get(item.pack_id) ?? [];
    arr.push(item);
    itemsByPack.set(item.pack_id, arr);
  }

  return packs.map((p) => {
    const items = itemsByPack.get(p.id as string) ?? [];
    return {
      ...(p as unknown as PackRegaloCompleto),
      items,
      stock_disponible: calcularStock(items),
    };
  });
}
