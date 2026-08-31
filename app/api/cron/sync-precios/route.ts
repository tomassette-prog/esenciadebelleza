import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Vercel Cron Job — sincronización diaria automática
 *
 * Ejecuta a las 03:00 UTC cada día (configurado en vercel.json).
 * Tres fases: importar productos nuevos → actualizar precios/stock → actualizar ofertas.
 *
 * Autenticación: Vercel envía automáticamente `Authorization: Bearer <CRON_SECRET>`.
 * Si CRON_SECRET no está configurado, el endpoint rechaza toda petición.
 */

export const maxDuration = 300; // 5 minutos — suficiente para ~3000 productos
export const dynamic = "force-dynamic";

// ── Helpers ───────────────────────────────────────────────────────────────────

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const WOO_URL = process.env.WOO_URL!;
const CK = process.env.WOO_CONSUMER_KEY!;
const CS = process.env.WOO_CONSUMER_SECRET!;

async function fetchWoo(path: string) {
  const auth = Buffer.from(`${CK}:${CS}`).toString("base64");
  const res = await fetch(`${WOO_URL}/wp-json/wc/v3${path}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`WooCommerce ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

function normalizarNombre(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:()[\]"'ºª-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// ── Fase 1: Importar productos nuevos ────────────────────────────────────────

async function importarNuevos(db: ReturnType<typeof supa>): Promise<{ nuevos: number; errores: number }> {
  const { data: lastSyncRow } = await db.from("config_tienda").select("valor").eq("clave", "ultima_import_wc").single();
  const lastSync = lastSyncRow?.valor ?? null;
  const now = new Date().toISOString();

  // Cargar mapa de productos existentes (woo_id y slug)
  const existentesPorWooId = new Map<number, string>();
  const existentesPorSlug = new Map<string, boolean>();
  let offset = 0;
  while (true) {
    const { data } = await db.from("productos_padre").select("id, woo_id, slug").range(offset, offset + 999);
    if (!data?.length) break;
    for (const r of data) {
      if (r.woo_id) existentesPorWooId.set(r.woo_id, r.id);
      if (r.slug) existentesPorSlug.set(r.slug, true);
    }
    if (data.length < 1000) break;
    offset += 1000;
  }

  // Cargar multiplicador B2C
  let precioMultiplicador = 1;
  try {
    const { data: cfg } = await db.from("config_tienda").select("valor").eq("clave", "precio_multiplicador_b2c").single();
    if (cfg?.valor) precioMultiplicador = parseFloat(cfg.valor) || 1;
  } catch { /* fallback */ }

  let totalNuevos = 0;
  let totalErrores = 0;
  let page = 1;

  while (true) {
    const url = lastSync
      ? `/products?per_page=100&page=${page}&status=publish&modified_after=${lastSync}`
      : `/products?per_page=100&page=${page}&status=publish`;
    const batch: any[] = await fetchWoo(url);
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const p of batch) {
      const slug = p.slug || slugify(p.name);
      if (existentesPorWooId.has(p.id) || existentesPorSlug.has(slug)) continue;

      try {
        // Resolver marca
        let marcaId: string | null = null;
        const nombreLower = p.name.toLowerCase();
        const { data: marcas } = await db.from("marcas").select("id, nombre");
        if (marcas) {
          for (const m of marcas) {
            if (nombreLower.includes(m.nombre.toLowerCase())) { marcaId = m.id; break; }
          }
        }

        // Insertar producto padre
        const { data: inserted, error: insertErr } = await db.from("productos_padre").insert({
          nombre: p.name,
          slug,
          woo_id: p.id,
          descripcion: p.description || "",
          descripcion_corta: p.short_description || "",
          imagen_principal_url: p.images?.[0]?.src ?? null,
          marca_id: marcaId,
          activo: true,
          oferta: false,
        }).select("id").single();

        if (insertErr || !inserted) { totalErrores++; continue; }

        // Insertar variaciones
        if (p.type === "simple") {
          const precioRegular = parseFloat(p.regular_price || p.price) || 0;
          const precioVenta = parseFloat(p.sale_price) || 0;
          const isOferta = precioVenta > 0 && precioVenta < precioRegular;
          const precioB2c = isOferta ? precioVenta : precioRegular;

          await db.from("productos_variaciones").insert({
            producto_padre_id: inserted.id,
            sku: p.sku || `WC-${p.id}`,
            nombre_variacion: "Unidad",
            precio_b2c: precioB2c,
            precio_b2b: parseFloat((precioB2c * precioMultiplicador).toFixed(2)),
            precio_comparar: isOferta ? precioRegular : null,
            stock: p.stock_quantity ?? 0,
            activa: true,
            imagen_url: p.images?.[0]?.src ?? null,
          });
        } else if (p.type === "variable" && p.variations?.length > 0) {
          try {
            const wcVars: any[] = await fetchWoo(`/products/${p.id}/variations?per_page=100`);
            for (const wv of wcVars) {
              const precioRegular = parseFloat(wv.regular_price || wv.price) || 0;
              const precioVenta = parseFloat(wv.sale_price) || 0;
              const isOferta = precioVenta > 0 && precioVenta < precioRegular;
              const precioB2c = isOferta ? precioVenta : precioRegular;

              await db.from("productos_variaciones").insert({
                producto_padre_id: inserted.id,
                sku: wv.sku || `WC-${p.id}-${wv.id}`,
                nombre_variacion: wv.attributes?.map((a: any) => a.option).join(" / ") || "Variante",
                precio_b2c: precioB2c,
                precio_b2b: parseFloat((precioB2c * precioMultiplicador).toFixed(2)),
                precio_comparar: isOferta ? precioRegular : null,
                stock: wv.stock_quantity ?? 0,
                activa: true,
                imagen_url: wv.image?.src ?? null,
              });
            }
          } catch { /* si falla la descarga de variaciones, al menos el padre queda creado */ }
        }

        totalNuevos++;
        existentesPorWooId.set(p.id, inserted.id);
        existentesPorSlug.set(slug, true);
      } catch { totalErrores++; }
    }

    if (batch.length < 100) break;
    page++;
  }

  // Guardar timestamp de última importación
  await db.from("config_tienda").upsert({ clave: "ultima_import_wc", valor: now }, { onConflict: "clave" });
  return { nuevos: totalNuevos, errores: totalErrores };
}

// ── Fase 2: Actualizar precios y stock ───────────────────────────────────────

async function sincronizarPrecios(db: ReturnType<typeof supa>): Promise<{ actualizados: number; noEncontrados: number }> {
  // Cargar multiplicador B2B
  let precioMultiplicador = 0.75;
  try {
    const { data: cfg } = await db.from("config_tienda").select("valor").eq("clave", "precio_multiplicador_b2b").single();
    if (cfg?.valor) precioMultiplicador = parseFloat(cfg.valor) || 0.75;
  } catch { /* fallback */ }

  // Cargar productos padre (por woo_id y nombre)
  const padresPorWooId = new Map<number, string>();
  const padresPorNombre = new Map<string, string>();
  let offset = 0;
  while (true) {
    const { data } = await db.from("productos_padre").select("id, woo_id, nombre").range(offset, offset + 999);
    if (!data?.length) break;
    for (const r of data) {
      if (r.woo_id) padresPorWooId.set(r.woo_id, r.id);
      padresPorNombre.set(normalizarNombre(r.nombre), r.id);
    }
    if (data.length < 1000) break;
    offset += 1000;
  }

  // Cargar variaciones existentes
  const allVars: Array<{ id: string; sku: string | null; producto_padre_id: string }> = [];
  offset = 0;
  while (true) {
    const { data } = await db.from("productos_variaciones").select("id, sku, producto_padre_id").range(offset, offset + 999);
    if (!data?.length) break;
    allVars.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  const varsBySku = new Map(allVars.filter(v => v.sku).map(v => [v.sku as string, v]));
  const varsByPadreId = new Map<string, typeof allVars>();
  for (const v of allVars) {
    const arr = varsByPadreId.get(v.producto_padre_id) ?? [];
    arr.push(v);
    varsByPadreId.set(v.producto_padre_id, arr);
  }

  let actualizados = 0;
  const noEncontradosSet = new Set<string>();
  const ofertaPorPadre = new Map<string, boolean>();
  const wooIdsPorBackfillear = new Map<string, number>();

  async function updateVar(varId: string, padreId: string, precioB2c: number, precioRegular: number, isOferta: boolean, stock: number, activa: boolean) {
    await db.from("productos_variaciones").update({
      precio_b2c: precioB2c,
      precio_b2b: parseFloat((precioB2c * precioMultiplicador).toFixed(2)),
      precio_comparar: isOferta ? precioRegular : null,
      stock,
      activa,
    }).eq("id", varId);
    ofertaPorPadre.set(padreId, ofertaPorPadre.get(padreId) || isOferta);
    actualizados++;
  }

  let page = 1;
  while (true) {
    const wooProducts: any[] = await fetchWoo(`/products?per_page=100&page=${page}&status=publish`);
    if (!Array.isArray(wooProducts) || wooProducts.length === 0) break;

    // Simple products
    for (const wp of wooProducts) {
      if (wp.type !== "simple") continue;
      const precioRegular = parseFloat(wp.regular_price || wp.price) || 0;
      const precioVenta = parseFloat(wp.sale_price) || 0;
      const isOferta = precioVenta > 0 && precioVenta < precioRegular;
      const precioB2c = isOferta ? precioVenta : precioRegular;
      const stock = wp.stock_quantity ?? 0;
      const activa = wp.stock_status !== "outofstock";

      let existingVar = wp.sku ? varsBySku.get(wp.sku) : undefined;
      if (!existingVar) {
        const padreId = padresPorWooId.get(wp.id);
        if (padreId) existingVar = varsByPadreId.get(padreId)?.[0];
      }
      if (!existingVar) {
        const padreId = padresPorNombre.get(normalizarNombre(wp.name));
        if (padreId) {
          existingVar = varsByPadreId.get(padreId)?.[0];
          if (existingVar && !padresPorWooId.has(wp.id)) wooIdsPorBackfillear.set(padreId, wp.id);
        }
      }
      if (!existingVar) { noEncontradosSet.add(wp.name); continue; }
      await updateVar(existingVar.id, existingVar.producto_padre_id, precioB2c, precioRegular, isOferta, stock, activa);
    }

    // Variable products
    const variableProducts = wooProducts.filter(wp => wp.type === "variable" && wp.variations?.length > 0);
    for (const wp of variableProducts) {
      try {
        const wcVars: any[] = await fetchWoo(`/products/${wp.id}/variations?per_page=100`);
        if (!Array.isArray(wcVars) || wcVars.length === 0) { noEncontradosSet.add(wp.name); continue; }

        const resueltoPorNombre = !padresPorWooId.has(wp.id);
        const padreId = padresPorWooId.get(wp.id) ?? padresPorNombre.get(normalizarNombre(wp.name));
        const padreVars = padreId ? varsByPadreId.get(padreId) : undefined;
        let matchedAny = false;

        for (const wv of wcVars) {
          const existingVar = wv.sku ? varsBySku.get(wv.sku) : undefined;
          if (!existingVar) continue;
          const precioRegular = parseFloat(wv.regular_price || wv.price) || 0;
          const precioVenta = parseFloat(wv.sale_price) || 0;
          const isOferta = precioVenta > 0 && precioVenta < precioRegular;
          const precioB2c = isOferta ? precioVenta : precioRegular;
          const stock = wv.stock_quantity ?? 0;
          const activa = wv.stock_status !== "outofstock";
          matchedAny = true;
          await updateVar(existingVar.id, existingVar.producto_padre_id, precioB2c, precioRegular, isOferta, stock, activa);
        }

        if (!matchedAny && padreVars?.length === 1) {
          const precioRegular = parseFloat(wp.regular_price || wp.price) || 0;
          if (precioRegular > 0) {
            const precioVenta = parseFloat(wp.sale_price) || 0;
            const isOferta = precioVenta > 0 && precioVenta < precioRegular;
            const precioB2c = isOferta ? precioVenta : precioRegular;
            const stock = wp.stock_quantity ?? 0;
            const activa = wp.stock_status !== "outofstock";
            matchedAny = true;
            await updateVar(padreVars[0].id, padreVars[0].producto_padre_id, precioB2c, precioRegular, isOferta, stock, activa);
          }
        }

        if (matchedAny && resueltoPorNombre && padreId) wooIdsPorBackfillear.set(padreId, wp.id);
        if (!matchedAny) noEncontradosSet.add(wp.name);
        await new Promise(r => setTimeout(r, 300));
      } catch { noEncontradosSet.add(wp.name); }
    }

    if (wooProducts.length < 100) break;
    page++;
  }

  // Actualizar flags de oferta en productos padre
  for (const [padreId, isOferta] of Array.from(ofertaPorPadre)) {
    await db.from("productos_padre").update({ oferta: isOferta }).eq("id", padreId);
  }

  // Backfill woo_id
  for (const [padreId, wooId] of Array.from(wooIdsPorBackfillear)) {
    await db.from("productos_padre").update({ woo_id: wooId }).eq("id", padreId);
  }

  return { actualizados, noEncontrados: noEncontradosSet.size };
}

// ── Endpoint ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // 1. Verificar autenticación
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[CRON] CRON_SECRET no configurado — rechazando petición");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  console.log("[CRON] Iniciando sincronización diaria…");

  try {
    const db = supa();

    // Fase 1: Importar productos nuevos
    console.log("[CRON] Fase 1: Importar productos nuevos…");
    const importResult = await importarNuevos(db);
    console.log(`[CRON] Fase 1 completa: ${importResult.nuevos} nuevos, ${importResult.errores} errores`);

    // Fase 2: Actualizar precios y stock
    console.log("[CRON] Fase 2: Actualizar precios y stock…");
    const precioResult = await sincronizarPrecios(db);
    console.log(`[CRON] Fase 2 completa: ${precioResult.actualizados} actualizados, ${precioResult.noEncontrados} sin match`);

    // Guardar timestamp de última sincronización
    await db.from("config_tienda").upsert(
      { clave: "ultima_sync_cron", valor: new Date().toISOString() },
      { onConflict: "clave" }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const summary = {
      ok: true,
      duration: `${duration}s`,
      importacion: importResult,
      precios: precioResult,
    };
    console.log(`[CRON] Sincronización completada en ${duration}s`, summary);
    return NextResponse.json(summary);
  } catch (e) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[CRON] Error después de ${duration}s:`, e);
    return NextResponse.json({ error: String(e), duration: `${duration}s` }, { status: 500 });
  }
}
