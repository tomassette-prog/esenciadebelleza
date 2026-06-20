"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
    if (!tokenValue) return null;
    const parsed = JSON.parse(tokenValue);
    const accessToken: string = parsed.access_token;
    if (!accessToken) return null;
    const payloadB64 = accessToken.split(".")[1];
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (payload.sub && payload.exp * 1000 > Date.now()) return { id: payload.sub, email: payload.email };
    return null;
  } catch { return null; }
}

// ─── Crear carrusel ───────────────────────────────────────────────────────────
export async function crearCarrusel(
  nombre: string,
  subtitulo?: string
): Promise<{ error?: string; id?: string }> {
  await verificarAdmin();
  const supabase = createAdminClient();
  const { data: last } = await supabase
    .from("carruseles")
    .select("orden")
    .order("orden", { ascending: false })
    .limit(1)
    .single();
  const orden = (last?.orden ?? -1) + 1;
  const { data, error } = await supabase
    .from("carruseles")
    .insert({ nombre, subtitulo: subtitulo || null, activo: true, orden })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin/carruseles");
  return { id: data.id };
}

// ─── Actualizar nombre/subtítulo del carrusel ─────────────────────────────────
export async function actualizarCarrusel(
  id: string,
  nombre: string,
  subtitulo?: string
): Promise<{ error?: string }> {
  await verificarAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("carruseles")
    .update({ nombre, subtitulo: subtitulo || null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin/carruseles");
  return {};
}

// ─── Toggle activo/inactivo ───────────────────────────────────────────────────
export async function toggleCarruselActivo(
  id: string,
  activo: boolean
): Promise<{ error?: string }> {
  await verificarAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("carruseles").update({ activo }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin/carruseles");
  return {};
}

// ─── Eliminar carrusel ────────────────────────────────────────────────────────
export async function eliminarCarrusel(id: string): Promise<{ error?: string }> {
  await verificarAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("carruseles").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin/carruseles");
  return {};
}

// ─── Añadir producto a carrusel ───────────────────────────────────────────────
export async function añadirProductoCarrusel(
  carruselId: string,
  productoId: string
): Promise<{ error?: string }> {
  await verificarAdmin();
  const supabase = createAdminClient();
  const { data: last } = await supabase
    .from("carrusel_productos")
    .select("orden")
    .eq("carrusel_id", carruselId)
    .order("orden", { ascending: false })
    .limit(1)
    .single();
  const orden = (last?.orden ?? -1) + 1;
  const { error } = await supabase
    .from("carrusel_productos")
    .upsert({ carrusel_id: carruselId, producto_id: productoId, orden });
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin/carruseles");
  return {};
}

// ─── Quitar producto del carrusel ─────────────────────────────────────────────
export async function quitarProductoCarrusel(
  carruselId: string,
  productoId: string
): Promise<{ error?: string }> {
  await verificarAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("carrusel_productos")
    .delete()
    .eq("carrusel_id", carruselId)
    .eq("producto_id", productoId);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin/carruseles");
  return {};
}

// ─── Buscar productos para añadir ─────────────────────────────────────────────
export async function buscarProductosParaCarrusel(
  q: string,
  carruselId: string
): Promise<{
  id: string;
  nombre: string;
  marca: string | null;
  imagen_principal_url: string | null;
  enCarrusel: boolean;
}[]> {
  await verificarAdmin();
  const supabase = createAdminClient();

  // Productos ya en este carrusel
  const { data: enCarrusel } = await supabase
    .from("carrusel_productos")
    .select("producto_id")
    .eq("carrusel_id", carruselId);
  const idsEnCarrusel = new Set((enCarrusel ?? []).map((r) => r.producto_id));

  let query = supabase
    .from("productos_padre")
    .select("id, nombre, imagen_principal_url, marca:marcas(nombre)")
    .eq("activo", true)
    .order("nombre")
    .limit(30);

  if (q.trim()) {
    for (const word of q.trim().split(/\s+/).filter(Boolean)) {
      query = query.ilike("nombre", `%${word}%`);
    }
  } else {
    // Sin búsqueda: mostrar los que ya están en el carrusel primero
    query = supabase
      .from("productos_padre")
      .select("id, nombre, imagen_principal_url, marca:marcas(nombre)")
      .eq("activo", true)
      .in("id", idsEnCarrusel.size > 0 ? [...idsEnCarrusel] : ["00000000-0000-0000-0000-000000000000"])
      .order("nombre")
      .limit(50);
  }

  const { data } = await query;
  return (data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    marca: (Array.isArray(p.marca) ? p.marca[0] : p.marca as { nombre: string } | null)?.nombre ?? null,
    imagen_principal_url: p.imagen_principal_url,
    enCarrusel: idsEnCarrusel.has(p.id),
  }));
}
