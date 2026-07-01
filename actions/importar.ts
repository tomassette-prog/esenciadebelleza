"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { WOO_CAT_MAP } from "@/lib/categorias";
import { slugifyCategoria } from "@/lib/seo";

const ADMIN_EMAILS = ["ziarresamot@gmail.com"];
const WOO_URL  = process.env.WOO_URL!;
const CK       = process.env.WOO_CONSUMER_KEY!;
const CS       = process.env.WOO_CONSUMER_SECRET!;

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

async function fetchWoo(path: string) {
  const auth = Buffer.from(`${CK}:${CS}`).toString("base64");
  const res = await fetch(`${WOO_URL}/wp-json/wc/v3${path}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`WooCommerce ${res.status}`);
  return res.json();
}

function slugify(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function resolverCategoria(cats: { id: number }[]) {
  for (const cat of cats) {
    const mapped = WOO_CAT_MAP[cat.id];
    if (mapped) return mapped;
  }
  return { categoria: "peluqueria", subcategoria: "peluqueria-general" };
}

export interface ProductoDiff {
  slug: string;
  nombre: string;
  tipo: "nuevo" | "modificado";
  cambios?: Record<string, { woo: string | null; actual: string | null }>;
}

export async function calcularDiff(): Promise<{
  nuevos: ProductoDiff[];
  modificados: ProductoDiff[];
  iguales: number;
  error?: string;
}> {
  try {
    await verificarAdmin();
  } catch {
    return { nuevos: [], modificados: [], iguales: 0, error: "No autorizado" };
  }

  try {
    // 1. Descargar WooCommerce (paginado)
    const wooProductos: {
      id: number; name: string; slug: string; type: string;
      description: string; short_description: string;
      images: { src: string }[];
      categories: { id: number }[];
    }[] = [];
    let page = 1;
    while (true) {
      const batch = await fetchWoo(`/products?status=publish&per_page=100&page=${page}`);
      if (!Array.isArray(batch) || batch.length === 0) break;
      wooProductos.push(...batch);
      if (batch.length < 100) break;
      page++;
    }

    // 2. Cargar Supabase
    const supa = adminClient();
    const supaMap = new Map<string, {
      nombre: string; categoria: string; subcategoria: string | null;
      imagen_principal_url: string | null; descripcion_general: string | null;
    }>();
    let offset = 0;
    while (true) {
      const { data } = await supa
        .from("productos_padre")
        .select("slug, nombre, categoria, subcategoria, imagen_principal_url, descripcion_general")
        .range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const r of data) supaMap.set(r.slug, r);
      if (data.length < 1000) break;
      offset += 1000;
    }

    // 3. Comparar
    const nuevos: ProductoDiff[] = [];
    const modificados: ProductoDiff[] = [];
    let iguales = 0;

    for (const p of wooProductos) {
      const slug = p.slug || slugify(p.name);
      const existing = supaMap.get(slug);
      const { categoria, subcategoria } = resolverCategoria(p.categories);

      if (!existing) {
        nuevos.push({ slug, nombre: p.name, tipo: "nuevo" });
        continue;
      }

      const cambios: ProductoDiff["cambios"] = {};
      if (p.name.trim() !== existing.nombre)
        cambios["nombre"] = { woo: p.name.trim(), actual: existing.nombre };
      if (categoria !== existing.categoria)
        cambios["categoria"] = { woo: categoria, actual: existing.categoria };
      if (subcategoria !== (existing.subcategoria ?? ""))
        cambios["subcategoria"] = { woo: subcategoria, actual: existing.subcategoria ?? "" };
      const imgWoo = p.images[0]?.src ?? null;
      if (imgWoo !== existing.imagen_principal_url)
        cambios["imagen"] = { woo: imgWoo, actual: existing.imagen_principal_url };

      if (Object.keys(cambios).length > 0) {
        modificados.push({ slug, nombre: p.name, tipo: "modificado", cambios });
      } else {
        iguales++;
      }
    }

    return { nuevos, modificados, iguales };
  } catch (e) {
    return { nuevos: [], modificados: [], iguales: 0, error: String(e) };
  }
}

export async function aplicarCambios(slugs: string[]): Promise<{ ok: number; error?: string }> {
  try {
    await verificarAdmin();
  } catch {
    return { ok: 0, error: "No autorizado" };
  }

  if (!slugs.length) return { ok: 0 };

  try {
    // Descargar solo los productos seleccionados usando el parámetro slug de WooCommerce
    // (evita descargar los 3000+ productos completos)
    type WooProducto = {
      id: number; name: string; slug: string; type: string; variations: number[];
      description: string; short_description: string; sku: string;
      price: string; regular_price: string; sale_price: string;
      stock_quantity: number | null; stock_status: string;
      images: { src: string }[];
      categories: { id: number }[];
    };
    const seleccionados: WooProducto[] = [];

    // WooCommerce acepta hasta ~10 slugs por request con ?slug=a,b,c
    const CHUNK = 10;
    for (let i = 0; i < slugs.length; i += CHUNK) {
      const chunk = slugs.slice(i, i + CHUNK);
      const batch = await fetchWoo(`/products?status=publish&per_page=${CHUNK}&slug=${chunk.join(",")}`);
      if (Array.isArray(batch)) seleccionados.push(...batch);
    }
    const supa = adminClient();

    // Obtener slugs existentes para preservar flags
    const slugsExistentes = seleccionados.map(p => p.slug || slugify(p.name));
    const { data: existentes } = await supa
      .from("productos_padre")
      .select("slug, activo, destacado, nuevo")
      .in("slug", slugsExistentes);
    const existMap = new Map((existentes ?? []).map(e => [e.slug, e]));

    // Preparar upsert
    const rows = seleccionados.map(p => {
      const slug = p.slug || slugify(p.name);
      const { categoria, subcategoria } = resolverCategoria(p.categories);
      const ex = existMap.get(slug);
      const precioB2c = parseFloat(p.price || p.regular_price) || 0;
      return {
        nombre: p.name.trim(),
        slug,
        categoria,
        subcategoria,
        descripcion_general: p.description || p.short_description || null,
        imagen_principal_url: p.images[0]?.src ?? null,
        seo_title: `${p.name.trim()} | Esencia de Belleza`,
        seo_description: `Compra ${p.name.trim()} al mejor precio. Envío 24-48h a toda España.`,
        activo:    ex?.activo    ?? true,
        destacado: ex?.destacado ?? false,
        nuevo:     ex?.nuevo     ?? false,
      };
    });

    const { error } = await supa.from("productos_padre").upsert(rows, { onConflict: "slug" });
    if (error) return { ok: 0, error: error.message };

    // Upsert variaciones para productos simples (precio/stock)
    for (const p of seleccionados) {
      if (p.type !== "simple" || !p.sku) continue;
      const { data: padre } = await supa.from("productos_padre").select("id").eq("slug", p.slug || slugify(p.name)).single();
      if (!padre) continue;
      const precio = parseFloat(p.price || p.regular_price) || 0;
      const stock = p.stock_quantity ?? (p.stock_status === "instock" ? 1 : 0);
      await supa.from("productos_variaciones").upsert({
        producto_id: padre.id,
        sku: p.sku,
        nombre_variacion: "Unidad",
        precio_b2c: precio,
        precio_b2b: precio,
        stock,
        activa: true,
      }, { onConflict: "sku" });
    }

    return { ok: rows.length };
  } catch (e) {
    return { ok: 0, error: String(e) };
  }
}
