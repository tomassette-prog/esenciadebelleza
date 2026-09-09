"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarAdmin } from "@/lib/admin-auth";

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface Cupon {
  id: string;
  codigo: string;
  descripcion: string | null;
  tipo: "porcentaje" | "fijo";
  valor: number;
  usos_maximos: number | null;
  usos_actuales: number;
  fecha_expiracion: string | null;
  importe_minimo: number;
  activo: boolean;
  created_at: string;
}

// ── Crear cupón ───────────────────────────────────────────────────────────────
export async function crearCupon(
  datos: {
    codigo: string;
    descripcion?: string;
    tipo: "porcentaje" | "fijo";
    valor: number;
    usos_maximos?: number;
    fecha_expiracion?: string;
    importe_minimo?: number;
  }
): Promise<{ error?: string; cuponId?: string }> {
  const admin = await verificarAdmin();
  if (!admin) return { error: "No autorizado" };

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("cupones")
    .insert({
      codigo: datos.codigo.toUpperCase().trim(),
      descripcion: datos.descripcion?.trim() || null,
      tipo: datos.tipo,
      valor: datos.valor,
      usos_maximos: datos.usos_maximos ?? null,
      fecha_expiracion: datos.fecha_expiracion ?? null,
      importe_minimo: datos.importe_minimo ?? 0,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Ya existe un cupón con ese código" };
    return { error: error.message };
  }

  revalidatePath("/admin/cupones");
  return { cuponId: data.id };
}

// ── Actualizar cupón ──────────────────────────────────────────────────────────
export async function actualizarCupon(
  id: string,
  datos: {
    descripcion?: string;
    tipo?: "porcentaje" | "fijo";
    valor?: number;
    usos_maximos?: number | null;
    fecha_expiracion?: string | null;
    importe_minimo?: number;
    activo?: boolean;
  }
): Promise<{ error?: string }> {
  const admin = await verificarAdmin();
  if (!admin) return { error: "No autorizado" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("cupones")
    .update(datos)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/cupones");
  return {};
}

// ── Eliminar cupón ────────────────────────────────────────────────────────────
export async function eliminarCupon(id: string): Promise<{ error?: string }> {
  const admin = await verificarAdmin();
  if (!admin) return { error: "No autorizado" };

  const supabase = createAdminClient();
  const { error } = await supabase.from("cupones").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/cupones");
  return {};
}

// ── Validar cupón (público — para checkout) ───────────────────────────────────
export async function validarCupon(
  codigo: string,
  subtotal: number
): Promise<{
  valido: boolean;
  error?: string;
  cupon?: {
    id: string;
    codigo: string;
    descripcion: string | null;
    tipo: "porcentaje" | "fijo";
    valor: number;
    descuento: number;
  };
}> {
  const supabase = createAdminClient();
  const codigoUpper = codigo.toUpperCase().trim();

  const { data: cupon } = await supabase
    .from("cupones")
    .select("*")
    .eq("codigo", codigoUpper)
    .single();

  if (!cupon) return { valido: false, error: "Cupón no válido" };
  if (!cupon.activo) return { valido: false, error: "Este cupón ya no está activo" };

  // Verificar caducidad
  if (cupon.fecha_expiracion && new Date(cupon.fecha_expiracion) < new Date()) {
    return { valido: false, error: "Este cupón ha expirado" };
  }

  // Verificar usos máximos
  if (cupon.usos_maximos !== null && cupon.usos_actuales >= cupon.usos_maximos) {
    return { valido: false, error: "Este cupón ha alcanzado el límite de usos" };
  }

  // Verificar importe mínimo
  if (subtotal < cupon.importe_minimo) {
    return {
      valido: false,
      error: `El pedido mínimo para este cupón es de ${cupon.importe_minimo.toFixed(2)} €`,
    };
  }

  // Calcular descuento
  let descuento: number;
  if (cupon.tipo === "porcentaje") {
    descuento = subtotal * (cupon.valor / 100);
  } else {
    descuento = Math.min(cupon.valor, subtotal); // No puede ser mayor que el subtotal
  }

  return {
    valido: true,
    cupon: {
      id: cupon.id,
      codigo: cupon.codigo,
      descripcion: cupon.descripcion,
      tipo: cupon.tipo,
      valor: cupon.valor,
      descuento: Math.round(descuento * 100) / 100,
    },
  };
}

// ── Registrar uso de cupón (tras confirmar pago) ─────────────────────────────
export async function registrarUsoCupon(
  cuponId: string,
  pedidoId: string,
  usuarioId: string | null,
  descuentoAplicado: number
): Promise<void> {
  const supabase = createAdminClient();

  // Insertar en historial de uso
  await supabase.from("cupones_uso").insert({
    cupon_id:          cuponId,
    pedido_id:         pedidoId,
    usuario_id:        usuarioId,
    descuento_aplicado: descuentoAplicado,
  });

  // Incrementar contador de usos
  const { data: c } = await supabase
    .from("cupones")
    .select("usos_actuales")
    .eq("id", cuponId)
    .single();
  if (c) {
    await supabase
      .from("cupones")
      .update({ usos_actuales: c.usos_actuales + 1 })
      .eq("id", cuponId);
  }
}
