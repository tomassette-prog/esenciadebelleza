import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  ORIGEN_IMAGENES,
  copiarImagen,
  necesitaCopia,
  rutaImagenPadre,
  rutaImagenVariacion,
  sleep,
} from "@/lib/imagenes-locales";
import { ejecutarTrabajoConversion } from "@/lib/trabajo-conversion";

export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;
const LOTE_MAXIMO = 120; // copias por ejecución del cron
const LOTE_MAXIMO_MANUAL = 500;
const VENTANA = 500; // filas inspeccionadas por consulta
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
 * copies images that have no local copy yet (backfill, self-draining) and
 * images of recently updated rows whose supplier image changed. Never
 * modifies imagen_principal_url / imagen_url.
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

  const colsPadre = "id, slug, imagen_principal_url, imagen_local_url, imagen_origen_url";
  const colsVar = "id, nombre_variacion, imagen_url, imagen_local_url, imagen_origen_url, productos_padre(slug)";

  // Backfill: filas sin copia (la consulta se vacía sola a medida que se copian)
  const { data: sinCopiaPadres } = await supabase
    .from("productos_padre")
    .select(colsPadre)
    .is("imagen_local_url", null)
    .like("imagen_principal_url", `%${ORIGEN_IMAGENES}%`)
    .order("id", { ascending: true })
    .limit(VENTANA);

  const { data: sinCopiaVars } = await supabase
    .from("productos_variaciones")
    .select(colsVar)
    .is("imagen_local_url", null)
    .like("imagen_url", `%${ORIGEN_IMAGENES}%`)
    .order("id", { ascending: true })
    .limit(VENTANA);

  // Frescura: la importación diaria toca los productos modificados; ahí
  // pueden entrar imágenes nuevas o cuyo origen cambió.
  const { data: recientesPadres } = await supabase
    .from("productos_padre")
    .select(colsPadre)
    .not("imagen_principal_url", "is", null)
    .order("updated_at", { ascending: false })
    .limit(VENTANA);

  const { data: recientesVars } = await supabase
    .from("productos_variaciones")
    .select(colsVar)
    .not("imagen_url", "is", null)
    .order("updated_at", { ascending: false })
    .limit(VENTANA);

  const padresUnicos = new Map<string, any>();
  for (const p of [...(sinCopiaPadres ?? []), ...(recientesPadres ?? [])]) padresUnicos.set(p.id, p);
  const varsUnicas = new Map<string, any>();
  for (const v of [...(sinCopiaVars ?? []), ...(recientesVars ?? [])]) varsUnicas.set(v.id, v);

  const trabajos: Trabajo[] = [];
  for (const p of padresUnicos.values()) {
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
  for (const v of varsUnicas.values()) {
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

  // El trabajo de emails de conversión se ejecuta aquí para no superar el
  // límite de crons del plan (el endpoint manual sigue disponible)
  const conversion = await ejecutarTrabajoConversion();

  return NextResponse.json({
    copiadas,
    fallidas,
    inspeccionados: {
      padres: padresUnicos.size,
      variaciones: varsUnicas.size,
    },
    loteCompleto: trabajos.length >= lote,
    conversion,
  });
}
