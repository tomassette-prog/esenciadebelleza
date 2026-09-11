import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolverCategoriaSimple, validarCategoriaPorNombre } from "@/lib/woo-cat-resolver";

export const maxDuration = 300; // 300s en Pro / capped a 60s en Hobby

const CRON_SECRET = process.env.CRON_SECRET;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function fetchWoo<T = unknown>(path: string): Promise<T> {
  const auth = Buffer.from(`${process.env.WOO_CONSUMER_KEY}:${process.env.WOO_CONSUMER_SECRET}`).toString("base64");
  const res = await fetch(`${process.env.WOO_URL}/wp-json/wc/v3${path}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`WooCommerce ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// â”€â”€ Tipos WooCommerce â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface WooProduct {
  id: number; type: string; sku: string; name: string; slug: string;
  status: string;
  regular_price: string; sale_price: string; price: string;
  stock_quantity: number | null; stock_status: string; manage_stock: boolean;
  images: { src: string }[];
  categories: { id: number; slug: string }[];
  attributes: { name: string; options: string[] }[];
  description: string; short_description: string;
  variations: number[];
}

interface WooVariation {
  id: number; sku: string; price: string;
  regular_price: string; sale_price: string;
  stock_quantity: number | null; stock_status: string; manage_stock: boolean;
  attributes: { name: string; option: string }[];
  image: { src: string } | null;
  status: string;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supa = adminClient();

  // â”€â”€ ConfiguraciÃ³n â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let b2bMult = 0.75;
  try {
    const { data } = await supa.from("config_tienda").select("valor").eq("clave", "precio_multiplicador_b2b").single();
    if (data?.valor) b2bMult = parseFloat(data.valor) || 0.75;
  } catch { /* fallback */ }

  // â”€â”€ Cargar todas las variaciones Supabase (sku â†’ id) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const allVars: Array<{ id: string; sku: string | null; producto_padre_id: string }> = [];
  let offset = 0;
  while (true) {
    const { data } = await supa.from("productos_variaciones").select("id, sku, producto_padre_id").range(offset, offset + 999);
    if (!data?.length) break;
    allVars.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  const varsBySku = new Map(allVars.filter(v => v.sku).map(v => [v.sku as string, v]));

  // â€"â€" Cargar todos los productos_padre (woo_id → id + slug → id) â€"â€"â€"â€"â€"â€"â€"â€"â€"â€"â€"â€"â€"â€"â€"â€"â€"â€"â€"â€"â€"â€"â€"
  const allPadres: Array<{ id: string; woo_id: string | null; slug: string }> = [];
  offset = 0;
  while (true) {
    const { data } = await supa.from("productos_padre").select("id, woo_id, slug").range(offset, offset + 999);
    if (!data?.length) break;
    allPadres.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  const padresByWooId = new Map(allPadres.filter(p => p.woo_id).map(p => [p.woo_id as string, p.id]));
  // Fallback: slug → id para productos que aún no tienen woo_id
  const padresBySlug = new Map(allPadres.map(p => [p.slug, p.id]));

  // Backfill woo_id para productos que ya existen por slug pero no tienen woo_id
  let backfilledWooIds = 0;

  // â”€â”€ Cargar marcas existentes (slug â†’ id) para lookup rÃ¡pido â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { data: marcasData } = await supa.from("marcas").select("id, slug");
  const marcasBySlug = new Map((marcasData ?? []).map(m => [m.slug as string, m.id as string]));

  // â”€â”€ IteraciÃ³n por pÃ¡ginas WooCommerce â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Load last sync timestamp for incremental processing
  // Los domingos hacemos full sync para corregir cualquier desincronización
  const { data: lastSyncRow } = await supa.from("config_tienda").select("valor").eq("clave", "ultima_cron_sync").single();
  const lastSync = lastSyncRow?.valor ?? null;
  const now = new Date();
  const isFullSyncDay = now.getDay() === 0; // domingo = full sync
  const modifiedAfter = (!isFullSyncDay && lastSync) ? lastSync : null;
  const nowISO = now.toISOString();

  let page = 1;
  const wooIdsVistos = new Set<string>();
  let totalActualizados = 0;
  let totalCreados = 0;
  let totalErrores = 0;

  while (true) {
    let products: WooProduct[];
    try {
      const modifiedParam = modifiedAfter ? `&modified_after=${modifiedAfter}` : "";
      products = await fetchWoo<WooProduct[]>(
        `/products?per_page=20&page=${page}&status=publish${modifiedParam}&_fields=id,type,sku,name,slug,status,regular_price,sale_price,price,stock_quantity,stock_status,manage_stock,images,categories,attributes,description,short_description,variations`
      );
    } catch (err) {
      console.error(`[cron/sync] Error page ${page}:`, err);
      break;
    }
    if (!Array.isArray(products) || products.length === 0) break;

    // Precargar mapa woo_id â†’ padre_id para productos de esta pÃ¡gina
    const wooIds = products.map(p => String(p.id));
    const varsByPadreId = new Map<string, typeof allVars>();
    for (const v of allVars) {
      const arr = varsByPadreId.get(v.producto_padre_id) ?? [];
      arr.push(v);
      varsByPadreId.set(v.producto_padre_id, arr);
    }

    // â”€â”€ Upsert batch de padres (metadatos + woo_id) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const padreUpserts: object[] = [];

    for (const wp of products) {
      const wooId = String(wp.id);
      wooIdsVistos.add(wooId);

      const catBase = await resolverCategoriaSimple(wp.categories ?? []);
      const { categoria, subcategoria } = validarCategoriaPorNombre(wp.name, catBase, wp.description || wp.short_description);
      const imagen = wp.images?.[0]?.src ?? null;
      const activo = wp.status === "publish";

      // Obtener o crear marca
      let marcaId: string | null = null;
      const marcaAttr = wp.attributes?.find(a => a.name.toLowerCase().includes("marca"));
      if (marcaAttr?.options?.[0]) {
        const nombreMarca = marcaAttr.options[0];
        const slugMarca = nombreMarca.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        if (marcasBySlug.has(slugMarca)) {
          marcaId = marcasBySlug.get(slugMarca)!;
        } else {
          // Crear marca nueva (solo si es genuinamente nueva)
          const { data: nuevaMarca } = await supa.from("marcas")
            .upsert({ nombre: nombreMarca, slug: slugMarca, activa: true }, { onConflict: "slug" })
            .select("id").single();
          if (nuevaMarca) {
            marcaId = nuevaMarca.id;
            marcasBySlug.set(slugMarca, nuevaMarca.id);
          }
        }
      }

      padreUpserts.push({
        woo_id: wooId,
        nombre: wp.name,
        slug: wp.slug,
        categoria,
        subcategoria,
        imagen_principal_url: imagen,
        activo,
        ...(marcaId ? { marca_id: marcaId } : {}),
      });
    }

    // Upsert batch de padres por woo_id
    if (padreUpserts.length > 0) {
      await supa.from("productos_padre").upsert(padreUpserts, { onConflict: "woo_id" });
    }

    // Recargar el mapa woo_id â†’ padre_id con los reciÃ©n insertados
    const { data: padresRecargados } = await supa.from("productos_padre")
      .select("id, woo_id").in("woo_id", wooIds);
    for (const p of padresRecargados ?? []) {
      if (p.woo_id) padresByWooId.set(p.woo_id, p.id);
    }

    // â”€â”€ Sync de precios, stock y variaciones â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    for (const wp of products) {
      const wooId = String(wp.id);
      // Buscar padre: primero por woo_id, luego fallback por slug
      let padreId = padresByWooId.get(wooId);
      if (!padreId) {
        padreId = padresBySlug.get(wp.slug);
        if (padreId) {
          // Backfill: el producto existe por slug pero le falta woo_id
          await supa.from("productos_padre").update({ woo_id: wooId }).eq("id", padreId);
          padresByWooId.set(wooId, padreId);
          backfilledWooIds++;
        }
      }
      if (!padreId) { totalErrores++; continue; }

      const precioRegular = parseFloat(wp.regular_price || wp.price) || 0;
      const precioVenta = parseFloat(wp.sale_price) || 0;
      const isOferta = precioVenta > 0 && precioVenta < precioRegular;
      const precioB2c = isOferta ? precioVenta : precioRegular;
      const precioB2b = parseFloat((precioB2c * b2bMult).toFixed(2));
      // Si WC no gestiona stock (manage_stock=false) y dice instock → stock alto (no limitar venta)
      const stock = wp.manage_stock ? (wp.stock_quantity ?? 0) : (wp.stock_status !== "outofstock" ? 9999 : 0);
      const activa = wp.stock_status !== "outofstock";

      if (wp.type === "simple") {
        const sku = wp.sku || wp.slug;
        await supa.from("productos_variaciones").upsert({
          producto_padre_id: padreId,
          sku,
          nombre_variacion: "Unidad",
          precio_b2c: precioB2c,
          precio_b2b: precioB2b,
          precio_comparar: isOferta ? precioRegular : null,
          stock,
          activa,
        }, { onConflict: "sku" });
        await supa.from("productos_padre").update({ oferta: isOferta }).eq("id", padreId);
        totalActualizados++;

      } else if (wp.type === "variable" && wp.variations?.length) {
        try {
          const wcVars = await fetchWoo<WooVariation[]>(
            `/products/${wp.id}/variations?per_page=100&_fields=id,sku,price,regular_price,sale_price,stock_quantity,stock_status,manage_stock,attributes,image,status`
          );
          const varUpserts = wcVars.map(wv => {
            const vReg = parseFloat(wv.regular_price || wv.price) || 0;
            const vSale = parseFloat(wv.sale_price) || 0;
            const vOferta = vSale > 0 && vSale < vReg;
            const vB2c = vOferta ? vSale : vReg;
            const sku = wv.sku || `${wp.slug}-${wv.id}`;
            const nombreVariacion = wv.attributes.map(a => a.option).join(" Â· ") || "Unidad";
            return {
              producto_padre_id: padreId,
              sku,
              nombre_variacion: nombreVariacion,
              precio_b2c: vB2c,
              precio_b2b: parseFloat((vB2c * b2bMult).toFixed(2)),
              precio_comparar: vOferta ? vReg : null,
              stock: wv.manage_stock ? (wv.stock_quantity ?? 0) : (wv.stock_status !== "outofstock" ? 9999 : 0),
              activa: wv.stock_status !== "outofstock",
              imagen_url: wv.image?.src ?? null,
            };
          });
          if (varUpserts.length > 0) {
            await supa.from("productos_variaciones").upsert(varUpserts, { onConflict: "sku" });
          }
          await supa.from("productos_padre").update({ oferta: isOferta }).eq("id", padreId);
          totalActualizados += varUpserts.length;
        } catch (err) {
          console.error(`[cron/sync] Error variaciones producto ${wooId}:`, err);
          totalErrores++;
        }
      }
    }

    // â”€â”€ Contar nuevos creados en esta pÃ¡gina â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    for (const wp of products) {
      const wooId = String(wp.id);
      if (!padresByWooId.has(wooId)) totalCreados++;
    }

    if (products.length < 20) break;
    page++;
  }

  // Save sync timestamp for next incremental run
  await supa.from("config_tienda").upsert({ clave: "ultima_cron_sync", valor: nowISO }, { onConflict: "clave" });

  // â”€â”€ Desactivar productos que ya no existen en WooCommerce â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const wooIdsActivosEnSupa = allPadres
    .filter(p => p.woo_id)
    .map(p => p.woo_id as string);

  const wooIdsADesactivar = wooIdsActivosEnSupa.filter(id => !wooIdsVistos.has(id));

  // Salvaguarda: NO desactivar si la API devolvio 0 productos o si se desactivarian mas del 20% del catalogo
  let desactivados = 0;
  if (wooIdsVistos.size === 0) {
    console.warn("[cron/sync] WooCommerce devolvio 0 productos. NO se desactiva nada (posible fallo de API).");
  } else if (wooIdsADesactivar.length > wooIdsActivosEnSupa.length * 0.2) {
    console.warn(`[cron/sync] Se desactivarian ${wooIdsADesactivar.length} de ${wooIdsActivosEnSupa.length} productos (${Math.round(wooIdsADesactivar.length / wooIdsActivosEnSupa.length * 100)}%). NO se desactiva nada (posible fallo de paginacion).`);
  } else if (wooIdsADesactivar.length > 0) {
    // Desactivar en lotes de 200 para no sobrepasar limites de URL
    for (let i = 0; i < wooIdsADesactivar.length; i += 200) {
      await supa.from("productos_padre")
        .update({ activo: false })
        .in("woo_id", wooIdsADesactivar.slice(i, i + 200));
    }
    desactivados = wooIdsADesactivar.length;
  }

  const resumen = {
    ok: true,
    syncType: modifiedAfter ? "incremental" : "full",
    actualizados: totalActualizados,
    creados: totalCreados,
    desactivados,
    wooIdsBackfilled: backfilledWooIds,
    errores: totalErrores,
  };
  console.log("[cron/sync]", resumen);
  return NextResponse.json(resumen);
}


