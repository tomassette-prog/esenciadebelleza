import { clienteServiceRole, despacharAvisosReposicion } from "@/lib/avisos-reposicion";
import { enviarSolicitudResena, enviarRecordatorioCarrito } from "@/lib/emails-conversion";
import { crearTokenResena } from "@/lib/resena-token";

// Conversion email job, shared by the daily mirror cron and the manual
// /api/cron/emails-conversion endpoint (kept below the Vercel cron limit:
// the plan accepts two crons, so this job piggybacks on the mirror one).

const WEB = process.env.NEXT_PUBLIC_SITE_URL ?? "https://esenciadebelleza.es";
const LOTE = 20;
const HORAS_ESPERA_CARRITO = 2;
const DIAS_ESPERA_RESENA = 3;

export interface ResumenConversion {
  resenasSolicitadas: number;
  carritosRecordados: number;
  carritosConvertidos: number;
  avisosEnviados: number;
}

export async function ejecutarTrabajoConversion(): Promise<ResumenConversion> {
  const supabase = clienteServiceRole();
  const ahora = new Date();
  const hace3d = new Date(ahora.getTime() - DIAS_ESPERA_RESENA * 24 * 60 * 60 * 1000).toISOString();
  const hace2h = new Date(ahora.getTime() - HORAS_ESPERA_CARRITO * 60 * 60 * 1000).toISOString();
  const hace7d = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // ── 1. Solicitudes de reseña (pedidos entregados hace 3+ días) ────────────
  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id, email_cliente")
    .eq("estado", "entregado")
    .is("resena_solicitada_at", null)
    .lte("created_at", hace3d)
    .order("created_at", { ascending: true })
    .limit(LOTE);

  let resenasSolicitadas = 0;
  for (const pedido of pedidos ?? []) {
    const { data: lineas } = await supabase
      .from("pedidos_lineas")
      .select("nombre, variacion_id")
      .eq("pedido_id", pedido.id);

    const variacionIds = [...new Set((lineas ?? []).map((l) => l.variacion_id).filter(Boolean))] as string[];
    const { data: vars } = variacionIds.length
      ? await supabase
          .from("productos_variaciones")
          .select("id, producto_padre_id, productos_padre(slug, categoria, subcategoria)")
          .in("id", variacionIds)
      : { data: [] as unknown[] };

    const vistos = new Set<string>();
    const productos: { nombre: string; urlResena: string }[] = [];
    for (const v of (vars ?? []) as Array<{
      producto_padre_id: string;
      productos_padre: { slug: string; categoria: string; subcategoria: string | null } | null;
    }>) {
      if (vistos.has(v.producto_padre_id) || !v.productos_padre) continue;
      vistos.add(v.producto_padre_id);
      const token = crearTokenResena({ email: pedido.email_cliente, productoId: v.producto_padre_id, pedidoId: pedido.id });
      productos.push({
        nombre: (lineas ?? []).find((l) => l.variacion_id)?.nombre ?? "Tu producto",
        urlResena: `${WEB}/resena/${token}`,
      });
    }
    if (!productos.length) continue;

    try {
      await enviarSolicitudResena({
        email: pedido.email_cliente,
        pedidoRef: `#${pedido.id.slice(0, 8).toUpperCase()}`,
        productos,
      });
      await supabase.from("pedidos").update({ resena_solicitada_at: ahora.toISOString() }).eq("id", pedido.id);
      resenasSolicitadas++;
    } catch (e) {
      console.error("[emails] reseña", pedido.id, (e as Error).message);
    }
  }

  // ── 2. Recordatorios de carrito abandonado ─────────────────────────────────
  const { data: carritos } = await supabase
    .from("carritos_abandonados")
    .select("id, email, items, created_at")
    .is("recordatorio_enviado_at", null)
    .is("converted_at", null)
    .lte("created_at", hace2h)
    .gte("created_at", hace7d)
    .order("created_at", { ascending: true })
    .limit(LOTE);

  let carritosRecordados = 0;
  let carritosConvertidos = 0;
  for (const carrito of carritos ?? []) {
    const { count } = await supabase
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .eq("email_cliente", carrito.email)
      .gte("created_at", carrito.created_at);
    if ((count ?? 0) > 0) {
      await supabase.from("carritos_abandonados").update({ converted_at: ahora.toISOString() }).eq("id", carrito.id);
      carritosConvertidos++;
      continue;
    }

    const items = (carrito.items ?? []) as Array<{ nombre: string; cantidad: number; precio: number }>;
    const total = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
    try {
      await enviarRecordatorioCarrito({
        email: carrito.email,
        items,
        total,
        urlRecuperar: `${WEB}/recuperar-carrito/${carrito.id}`,
      });
      await supabase.from("carritos_abandonados").update({ recordatorio_enviado_at: ahora.toISOString() }).eq("id", carrito.id);
      carritosRecordados++;
    } catch (e) {
      console.error("[emails] carrito", carrito.id, (e as Error).message);
    }
  }

  // ── 3. Avisos de reposición ────────────────────────────────────────────────
  const avisosEnviados = await despacharAvisosReposicion(supabase);

  return { resenasSolicitadas, carritosRecordados, carritosConvertidos, avisosEnviados };
}
