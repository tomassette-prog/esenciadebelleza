"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { slugifyCategoria } from "@/lib/seo";
import { redirect } from "next/navigation";

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

// ─── Generar slug único ────────────────────────────────────────────────────────
async function generarSlugUnico(nombre: string, excluirId?: string): Promise<string> {
  const supabase = createAdminClient();
  const base = slugifyCategoria(nombre);
  let slug = base;
  let i = 1;
  while (true) {
    let q = supabase.from("productos_padre").select("id").eq("slug", slug);
    if (excluirId) q = q.neq("id", excluirId);
    const { data } = await q.single();
    if (!data) break;
    slug = `${base}-${i++}`;
  }
  return slug;
}

// ─── Crear producto padre + primera variación ─────────────────────────────────
export async function crearProducto(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await verificarAdmin();
  const supabase = createAdminClient();

  const nombre = (formData.get("nombre") as string).trim();
  const categoria = (formData.get("categoria") as string).trim();
  const subcategoria = (formData.get("subcategoria") as string).trim() || null;
  const marca_id = (formData.get("marca_id") as string) || null;
  const descripcion = (formData.get("descripcion") as string) || null;
  const imagen_url = (formData.get("imagen_url") as string) || null;
  const seo_title = (formData.get("seo_title") as string) || null;
  const seo_description = (formData.get("seo_description") as string) || null;
  const destacado = formData.get("destacado") === "on";
  const nuevo = formData.get("nuevo") === "on";
  const oferta = formData.get("oferta") === "on";

  // Variación inicial (obligatoria)
  const sku = (formData.get("sku") as string).trim();
  const nombre_variacion = (formData.get("nombre_variacion") as string).trim() || "Único";
  const precio_b2c = parseFloat(formData.get("precio_b2c") as string);
  const precio_b2b = parseFloat(formData.get("precio_b2b") as string) || null;
  const stock = parseInt(formData.get("stock") as string, 10) || 0;

  if (!nombre || !categoria || !sku || isNaN(precio_b2c)) {
    return { error: "Nombre, categoría, SKU y precio B2C son obligatorios." };
  }

  const slug = await generarSlugUnico(nombre);

  const { data: padre, error: errPadre } = await supabase
    .from("productos_padre")
    .insert({
      nombre,
      slug,
      categoria,
      subcategoria,
      marca_id,
      descripcion_general: descripcion,
      imagen_principal_url: imagen_url,
      seo_title: seo_title || `${nombre} | Esencia de Belleza`,
      seo_description: seo_description || `Compra ${nombre} en Esencia de Belleza. Envío rápido en España.`,
      activo: true,
      destacado,
      nuevo,
      oferta,
    })
    .select("id, slug, categoria, subcategoria")
    .single();

  if (errPadre || !padre) return { error: errPadre?.message ?? "Error al crear el producto." };

  const { error: errVar } = await supabase.from("productos_variaciones").insert({
    producto_padre_id: padre.id,
    sku,
    nombre_variacion,
    precio_b2c,
    precio_b2b,
    stock,
    stock_minimo: 2,
    activa: true,
  });

  if (errVar) {
    // Rollback: borrar el padre si falla la variación
    await supabase.from("productos_padre").delete().eq("id", padre.id);
    return { error: errVar.message };
  }

  // Revalidar rutas afectadas
  revalidatePath("/");
  revalidatePath("/productos");
  revalidatePath(`/productos/${slugifyCategoria(padre.categoria)}`);
  if (padre.subcategoria) {
    revalidatePath(`/productos/${slugifyCategoria(padre.categoria)}/${slugifyCategoria(padre.subcategoria)}`);
  }
  revalidatePath(`/productos/${slugifyCategoria(padre.categoria)}/${slugifyCategoria(padre.subcategoria ?? "general")}/${padre.slug}`);
  revalidatePath("/sitemap.xml");

  redirect(`/admin/productos/${padre.id}`);
}

// ─── Actualizar producto padre ────────────────────────────────────────────────
export async function actualizarProducto(
  id: string,
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  await verificarAdmin();
  const supabase = createAdminClient();

  const nombre = (formData.get("nombre") as string).trim();
  const categoria = (formData.get("categoria") as string).trim();
  const subcategoria = (formData.get("subcategoria") as string).trim() || null;
  const marca_id = (formData.get("marca_id") as string) || null;
  const descripcion = (formData.get("descripcion") as string) || null;
  const imagen_url = (formData.get("imagen_url") as string) || null;
  const seo_title = (formData.get("seo_title") as string) || null;
  const seo_description = (formData.get("seo_description") as string) || null;
  const destacado = formData.get("destacado") === "on";
  const nuevo_flag = formData.get("nuevo") === "on";
  const oferta_flag = formData.get("oferta") === "on";
  const activo = formData.get("activo") !== "off";

  if (!nombre || !categoria) return { error: "Nombre y categoría son obligatorios." };

  // Actualizar slug si cambió el nombre
  const { data: actual } = await supabase
    .from("productos_padre")
    .select("nombre, slug, categoria, subcategoria")
    .eq("id", id)
    .single();

  let slug = actual?.slug;
  if (actual && actual.nombre !== nombre) {
    slug = await generarSlugUnico(nombre, id);
  }

  const { error } = await supabase
    .from("productos_padre")
    .update({
      nombre,
      slug,
      categoria,
      subcategoria,
      marca_id,
      descripcion_general: descripcion,
      imagen_principal_url: imagen_url,
      seo_title,
      seo_description,
      destacado,
      nuevo: nuevo_flag,
      oferta: oferta_flag,
      activo,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  // Revalidar rutas antiguas y nuevas
  const rutas = new Set([
    "/",
    "/productos",
    `/productos/${slugifyCategoria(categoria)}`,
    `/productos/${slugifyCategoria(actual?.categoria ?? categoria)}`,
  ]);
  if (subcategoria) rutas.add(`/productos/${slugifyCategoria(categoria)}/${slugifyCategoria(subcategoria)}`);
  if (actual?.subcategoria) rutas.add(`/productos/${slugifyCategoria(actual.categoria)}/${slugifyCategoria(actual.subcategoria)}`);
  if (slug) rutas.add(`/productos/${slugifyCategoria(categoria)}/${slugifyCategoria(subcategoria ?? "general")}/${slug}`);

  for (const ruta of rutas) revalidatePath(ruta);
  revalidatePath("/sitemap.xml");

  return { ok: true };
}

// ─── Eliminar producto (soft delete) ─────────────────────────────────────────
export async function eliminarProducto(id: string): Promise<{ error?: string }> {
  await verificarAdmin();
  const supabase = createAdminClient();

  const { data: padre } = await supabase
    .from("productos_padre")
    .select("slug, categoria, subcategoria")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("productos_padre")
    .update({ activo: false })
    .eq("id", id);

  if (error) return { error: error.message };

  if (padre) {
    revalidatePath("/productos");
    revalidatePath(`/productos/${slugifyCategoria(padre.categoria)}`);
    if (padre.subcategoria) {
      revalidatePath(`/productos/${slugifyCategoria(padre.categoria)}/${slugifyCategoria(padre.subcategoria)}`);
    }
    revalidatePath(`/productos/${slugifyCategoria(padre.categoria)}/${slugifyCategoria(padre.subcategoria ?? "general")}/${padre.slug}`);
  }
  revalidatePath("/sitemap.xml");

  return {};
}

// ─── Toggle flag de carrusel (oferta / nuevo / destacado) ────────────────────
export async function toggleCarruselFlag(
  productoId: string,
  flag: "oferta" | "nuevo" | "destacado",
  valor: boolean
): Promise<{ error?: string; ok?: boolean }> {
  await verificarAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("productos_padre")
    .update({ [flag]: valor })
    .eq("id", productoId);

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/productos");
  return { ok: true };
}

// ─── Buscar productos para el panel de carruseles ─────────────────────────────
export async function buscarProductosCarrusel(q: string): Promise<{
  id: string;
  nombre: string;
  marca: string | null;
  imagen_principal_url: string | null;
  oferta: boolean;
  nuevo: boolean;
  destacado: boolean;
}[]> {
  await verificarAdmin();
  const supabase = createAdminClient();

  let query = supabase
    .from("productos_padre")
    .select("id, nombre, imagen_principal_url, oferta, nuevo, destacado, marca:marcas(nombre)")
    .eq("activo", true)
    .order("nombre")
    .limit(40);

  if (q.trim()) {
    query = query.ilike("nombre", `%${q.trim()}%`);
  } else {
    // Sin búsqueda: mostrar los que ya están en algún carrusel
    query = query.or("oferta.eq.true,nuevo.eq.true,destacado.eq.true");
  }

  const { data, error } = await query;
  if (error) return [];

  return (data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    marca: (Array.isArray(p.marca) ? p.marca[0] : p.marca as { nombre: string } | null)?.nombre ?? null,
    imagen_principal_url: p.imagen_principal_url,
    oferta: p.oferta ?? false,
    nuevo: p.nuevo ?? false,
    destacado: p.destacado ?? false,
  }));
}

// ─── Crear variación ──────────────────────────────────────────────────────────
export async function crearVariacion(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await verificarAdmin();
  const supabase = createAdminClient();

  const producto_padre_id = formData.get("producto_padre_id") as string;
  const sku = (formData.get("sku") as string).trim();
  const nombre_variacion = (formData.get("nombre_variacion") as string).trim();
  const precio_b2c = parseFloat(formData.get("precio_b2c") as string);
  const precio_b2b = parseFloat(formData.get("precio_b2b") as string) || null;
  const stock = parseInt(formData.get("stock") as string, 10) || 0;
  const imagen_url = (formData.get("imagen_url") as string) || null;
  const ean_code = (formData.get("ean_code") as string) || null;

  if (!sku || !nombre_variacion || isNaN(precio_b2c)) {
    return { error: "SKU, nombre de variación y precio B2C son obligatorios." };
  }

  const { error } = await supabase.from("productos_variaciones").insert({
    producto_padre_id,
    sku,
    nombre_variacion,
    precio_b2c,
    precio_b2b,
    stock,
    stock_minimo: 2,
    imagen_url,
    ean_code,
    activa: true,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/productos/" + producto_padre_id);
  return {};
}

// ─── Actualizar variación ─────────────────────────────────────────────────────
export async function actualizarVariacion(
  variacionId: string,
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  await verificarAdmin();
  const supabase = createAdminClient();

  const precio_b2c = parseFloat(formData.get("precio_b2c") as string);
  const precio_b2b = parseFloat(formData.get("precio_b2b") as string) || null;
  const stock = parseInt(formData.get("stock") as string, 10);
  const nombre_variacion = (formData.get("nombre_variacion") as string).trim();
  const imagen_url = (formData.get("imagen_url") as string) || null;
  const ean_code = (formData.get("ean_code") as string) || null;
  const activa = formData.get("activa") !== "off";

  const { error } = await supabase
    .from("productos_variaciones")
    .update({ precio_b2c, precio_b2b, stock, nombre_variacion, imagen_url, ean_code, activa })
    .eq("id", variacionId);

  if (error) return { error: error.message };
  return { ok: true };
}

// ─── Eliminar variación (soft delete) ────────────────────────────────────────
export async function eliminarVariacion(variacionId: string): Promise<{ error?: string }> {
  await verificarAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("productos_variaciones")
    .update({ activa: false })
    .eq("id", variacionId);

  if (error) return { error: error.message };
  return {};
}

export async function generarSeoProducto(productoId: string): Promise<{ ok?: boolean; error?: string }> {
  await verificarAdmin();
  const supabase = createAdminClient();

  const { data: p, error: fetchErr } = await supabase
    .from("productos_padre")
    .select("id, nombre, categoria, subcategoria, slug")
    .eq("id", productoId)
    .single();

  if (fetchErr || !p) return { error: fetchErr?.message ?? "Producto no encontrado" };

  const { generarSeoProducto: genSeo } = await import("@/lib/seo-generator");
  const seoOutput = genSeo({
    nombre: p.nombre,
    marca: null,
    categoria: p.categoria,
    subcategoria: p.subcategoria,
    descripcion: null,
  });

  const { error: updateErr } = await supabase
    .from("productos_padre")
    .update({
      seo_title: seoOutput.seo_title,
      seo_description: seoOutput.seo_description,
      texto_enriquecido_seo: seoOutput.texto_enriquecido_seo,
    })
    .eq("id", productoId);

  if (updateErr) return { error: updateErr.message };
  revalidatePath("/admin/productos");
  return { ok: true };
}

