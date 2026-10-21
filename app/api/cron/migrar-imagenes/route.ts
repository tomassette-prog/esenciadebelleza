import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  copiarImagen,
  necesitaCopia,
  rutaImagenPadre,
  rutaImagenVariacion,
  sleep,
} from "@/lib/imagenes-locales";

export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;
const LOTE_MAXIMO = 120; // copias por ejecución del cron
const LOTE_MAXIMO_MANUAL = 500;
const VENTANA = 400; // filas recientes inspeccionadas por tabla
const DELAY_MS = 200; // ms entre descargas para no saturar el proveedor
const CONCURRENCIA = 4;

type Trabajo = () => Promise<"copiada" | "error">;

async function ejecutarConcurrente(trabajos: Trabajo[]): Promise<{ copiadas: number; fallidas: number }> {
  let i = 0;
  let copiadas = 0;
  let fallidas = 0;
  const obreros = Array.from({ length: Math.min(CONCURRENCIA, trabajos.length) }, async () => {
    while (i < trabajos.length) {
      const trabajo = trabajos[i++];
      const estado = await trabajo();
      if (estado === "copiada") copiadas++; else fallidas++;
      await sleep(DELAY_MS);
    }
  });
  await Promise.all(obreros);
  return { copiadas, fallidas };
}

/**
 * Keeps the local image mirror fresh after the daily WooCommerce sync:
 * copies images of recently updated rows that have no local copy yet or whose
 * supplier image changed. Never modifies imagen_principal_url / imagen_url.
 *
 * Auth: Vercel cron sends `Authorization: Bearer CRON_SECRET`. A manual run
 * can send `x-mirror-token` matching config_tienda.imagen_mirror_token; when
 * that row does not exist the manual path is disabled.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const auth = req.headers.get("authorization");
  const tokenManual = req.headers.get("x-mirror-token");
  let autorizado = !!CRON_SECRET && auth === "Bearer " + CRON_SECRET;
  if (!autorizado && tokenManual) {
    const { data } = await supabase
      .from("config_tienda")
      .select("valor")
      .eq("clave", "imagen_mirror_token")
      .maybeSingle();
    autorizado = !!data?.valor && data.valor === tokenManual;
  }
  if (!autorizado) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loteSolicitado = Number(req.nextUrl.searchParams.get("lote") ?? "") || LOTE_MAXIMO;
  const lote = Math.min(Math.max(Math.trunc(loteSolicitado), 1), LOTE_MAXIMO_MANUAL);

  const trabajos: Trabajo[] = [];

  // La importación diaria toca los productos modificados: su ventana
  // reciente es justo donde pueden entrar imágenes nuevas o cambiadas.
  const { data: padres } = await supabase
    .from("productos_padre")
    .select("id, slug, imagen_principal_url, imagen_local_url, imagen_origen_url")
    .not("imagen_principal_url", "is", null)
    .order("updated_at", { ascending: false })
    .limit(VENTANA);

  for (const p of padres ?? []) {
    if (trabajos.length >= lote) break;
    if (!necesitaCopia({
      imagen_local_url: p.imagen_local_url,
      imagen_origen_url: p.imagen_origen_url,
      origenActual: p.imagen_principal_url,
    })) continue;
    trabajos.push(() => copiarImagen(
      supabase, "productos_padre",
      { id: p.id, origenActual: p.imagen_principal_url },
      rutaImagenPadre(p.slug, p.imagen_principal_url!)
    ));
  }

  const { data: vars } = await supabase
    .from("productos_variaciones")
    .select("id, nombre_variacion, imagen_url, imagen_local_url, imagen_origen_url, productos_padre(slug)")
    .not("imagen_url", "is", null)
    .order("updated_at", { ascending: false })
    .limit(VENTANA);

  for (const v of vars ?? []) {
    if (trabajos.length >= lote) break;
    if (!necesitaCopia({
      imagen_local_url: v.imagen_local_url,
      imagen_origen_url: v.imagen_origen_url,
      origenActual: v.imagen_url,
    })) continue;
    const padre = Array.isArray(v.productos_padre) ? v.productos_padre[0] : v.productos_padre;
    trabajos.push(() => copiarImagen(
      supabase, "productos_variaciones",
      { id: v.id, origenActual: v.imagen_url },
      rutaImagenVariacion(padre?.slug ?? `prod-${v.id}`, v.nombre_variacion ?? "", v.imagen_url!)
    ));
  }

  const { copiadas, fallidas } = await ejecutarConcurrente(trabajos);

  return NextResponse.json({
    copiadas,
    fallidas,
    inspeccionados: { padres: padres?.length ?? 0, variaciones: vars?.length ?? 0 },
    loteCompleto: trabajos.length >= lote,
  });
}
