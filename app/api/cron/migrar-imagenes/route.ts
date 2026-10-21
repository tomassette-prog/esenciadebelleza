import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  copiarImagen,
  necesitaCopia,
  rutaImagenPadre,
  rutaImagenVariacion,
  sleep,
} from "@/lib/imagenes-locales";

export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;
const LOTE_MAXIMO = 120; // copias por ejecución: el resto queda para la siguiente
const VENTANA = 400; // filas recientes inspeccionadas por tabla
const DELAY_MS = 150; // ms entre descargas para no saturar el proveedor

/**
 * Keeps the local image mirror fresh after the daily WooCommerce sync:
 * copies images of recently updated rows that have no local copy yet or whose
 * supplier image changed. Never modifies imagen_principal_url / imagen_url.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== "Bearer " + CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let restantes = LOTE_MAXIMO;
  let copiadas = 0;
  let fallidas = 0;

  // La importación diaria toca los productos modificados: su ventana
  // reciente es justo donde pueden entrar imágenes nuevas o cambiadas.
  const { data: padres } = await supabase
    .from("productos_padre")
    .select("id, slug, imagen_principal_url, imagen_local_url, imagen_origen_url")
    .not("imagen_principal_url", "is", null)
    .order("updated_at", { ascending: false })
    .limit(VENTANA);

  for (const p of padres ?? []) {
    if (restantes <= 0) break;
    if (!necesitaCopia({
      imagen_local_url: p.imagen_local_url,
      imagen_origen_url: p.imagen_origen_url,
      origenActual: p.imagen_principal_url,
    })) continue;
    restantes--;
    const estado = await copiarImagen(
      supabase, "productos_padre",
      { id: p.id, origenActual: p.imagen_principal_url },
      rutaImagenPadre(p.slug, p.imagen_principal_url!)
    );
    if (estado === "copiada") copiadas++; else fallidas++;
    await sleep(DELAY_MS);
  }

  const { data: vars } = await supabase
    .from("productos_variaciones")
    .select("id, nombre_variacion, imagen_url, imagen_local_url, imagen_origen_url, productos_padre(slug)")
    .not("imagen_url", "is", null)
    .order("updated_at", { ascending: false })
    .limit(VENTANA);

  for (const v of vars ?? []) {
    if (restantes <= 0) break;
    if (!necesitaCopia({
      imagen_local_url: v.imagen_local_url,
      imagen_origen_url: v.imagen_origen_url,
      origenActual: v.imagen_url,
    })) continue;
    restantes--;
    const padre = Array.isArray(v.productos_padre) ? v.productos_padre[0] : v.productos_padre;
    const estado = await copiarImagen(
      supabase, "productos_variaciones",
      { id: v.id, origenActual: v.imagen_url },
      rutaImagenVariacion(padre?.slug ?? `prod-${v.id}`, v.nombre_variacion ?? "", v.imagen_url!)
    );
    if (estado === "copiada") copiadas++; else fallidas++;
    await sleep(DELAY_MS);
  }

  return NextResponse.json({ copiadas, fallidas, pendientesParaLaProximaEjecucion: restantes === 0 });
}
