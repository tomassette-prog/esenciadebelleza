import { createAdminClient } from "@/lib/supabase/admin";

// Tipos mínimos admitidos (estructuralmente compatibles con LineaCarrito/LineaPack)
interface LineaEntrada {
  variacion_id: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

interface PackEntrada {
  pack_id: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

export type ResultadoValidacion =
  | {
      ok: true;
      subtotal: number;
      descuento: number;
      cuponId: string | null;
      codigoCupon?: string;
    }
  | { ok: false; error: string };

/**
 * Valida precios contra la base de datos (productos y packs de regalo) y
 * recalcula el descuento del cupón SIEMPRE desde `cupones.tipo/valor` sobre el
 * subtotal calculado en el servidor.
 *
 * Regla de oro: ningún importe que llegue del cliente (precios, packs o
 * descuento) se usa tal cual. Si no coincide con la BD, se rechaza el pedido.
 */
export async function validarYCalcular(args: {
  lineas: LineaEntrada[];
  packs: PackEntrada[];
  cupon?: { id: string; descuento?: number } | null;
  tipoPrecio: "b2c" | "b2b";
}): Promise<ResultadoValidacion> {
  const { lineas, packs, cupon, tipoPrecio } = args;
  const supabase = createAdminClient();

  // ── Líneas: precio y disponibilidad contra la BD ──
  const variacionIds = [...new Set(lineas.map((l) => l.variacion_id).filter(Boolean))];
  if (variacionIds.length) {
    const { data: dbVars, error: errVars } = await supabase
      .from("productos_variaciones")
      .select("id, precio_b2c, precio_b2b, activa")
      .in("id", variacionIds);
    if (errVars) {
      return { ok: false, error: "No se pudieron validar los productos. Inténtalo de nuevo." };
    }

    const varsMap = new Map((dbVars ?? []).map((v) => [v.id, v]));
    for (const l of lineas) {
      const dbVar = varsMap.get(l.variacion_id);
      if (!dbVar || !dbVar.activa) {
        return { ok: false, error: `"${l.nombre}" ya no está disponible.` };
      }
      const okB2c = Math.abs(l.precio - dbVar.precio_b2c) <= 0.02;
      const okB2b =
        tipoPrecio === "b2b" && !!dbVar.precio_b2b && Math.abs(l.precio - dbVar.precio_b2b) <= 0.02;
      if (!okB2c && !okB2b) {
        return { ok: false, error: `El precio de "${l.nombre}" ha cambiado. Actualiza la página.` };
      }
    }
  }

  // ── Packs de regalo: precio y disponibilidad contra la BD ──
  if (packs.length) {
    const { data: dbPacks, error: errPacks } = await supabase
      .from("packs_regalo")
      .select("id, precio_pack, activo")
      .in("id", packs.map((p) => p.pack_id));
    if (errPacks) {
      return { ok: false, error: "No se pudieron validar los packs. Inténtalo de nuevo." };
    }

    const packsMap = new Map((dbPacks ?? []).map((p) => [p.id, p]));
    for (const p of packs) {
      const dbPack = packsMap.get(p.pack_id);
      if (!dbPack || !dbPack.activo) {
        return { ok: false, error: `El pack "${p.nombre}" ya no está disponible.` };
      }
      if (Math.abs(p.precio - dbPack.precio_pack) > 0.02) {
        return { ok: false, error: `El precio del pack "${p.nombre}" ha cambiado. Actualiza la página.` };
      }
    }
  }

  const subtotal =
    lineas.reduce((acc, l) => acc + l.precio * l.cantidad, 0) +
    packs.reduce((acc, p) => acc + p.precio * p.cantidad, 0);

  // ── Cupón: el descuento se RECALCULA con los datos de la BD ──
  let descuento = 0;
  let cuponId: string | null = null;
  let codigoCupon: string | undefined;
  if (cupon?.id) {
    const { data: c } = await supabase
      .from("cupones")
      .select("id, codigo, tipo, valor, activo, usos_maximos, usos_actuales, fecha_expiracion, importe_minimo")
      .eq("id", cupon.id)
      .single();

    const vigente =
      !!c &&
      c.activo &&
      (!c.fecha_expiracion || new Date(c.fecha_expiracion) >= new Date()) &&
      (c.usos_maximos === null || (c.usos_actuales ?? 0) < c.usos_maximos) &&
      subtotal >= (c.importe_minimo ?? 0);

    if (vigente && c) {
      const bruto = c.tipo === "porcentaje" ? (subtotal * c.valor) / 100 : c.valor;
      descuento = Math.min(Math.round(bruto * 100) / 100, subtotal);
      cuponId = c.id;
      codigoCupon = c.codigo;
    }
  }

  return { ok: true, subtotal, descuento, cuponId, codigoCupon };
}
