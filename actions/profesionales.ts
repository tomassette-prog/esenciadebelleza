"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarAdmin } from "@/lib/admin-auth";

export async function aprobarProfesional(
  userId: string,
  descuento?: number
): Promise<{ error?: string }> {
  const admin_user = await verificarAdmin();
  if (!admin_user) return { error: "No autorizado" };

  const supabase = createAdminClient();
  const update: Record<string, unknown> = { b2b_aprobado: true };
  if (descuento !== undefined) {
    update.descuento_b2b = Math.max(0, Math.min(100, Math.round(descuento)));
  }

  const { error } = await supabase
    .from("perfiles_usuario")
    .update(update)
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/admin/profesionales");
  revalidatePath(`/admin/profesionales/${userId}`);
  return {};
}

export async function rechazarProfesional(
  userId: string
): Promise<{ error?: string }> {
  const admin_user = await verificarAdmin();
  if (!admin_user) return { error: "No autorizado" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("perfiles_usuario")
    .update({ b2b_aprobado: false, tipo_cliente: "b2c" })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/admin/profesionales");
  revalidatePath(`/admin/profesionales/${userId}`);
  return {};
}

export async function actualizarDescuentoProfesional(
  userId: string,
  descuento: number
): Promise<{ error?: string }> {
  const admin_user = await verificarAdmin();
  if (!admin_user) return { error: "No autorizado" };

  const valor = Math.max(0, Math.min(100, Math.round(descuento)));

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("perfiles_usuario")
    .update({ descuento_b2b: valor })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/admin/profesionales");
  revalidatePath(`/admin/profesionales/${userId}`);
  return {};
}

// ── Detalle de un profesional (perfil + pedidos + facturas) ──────────────────
export async function obtenerDetalleProfesional(userId: string) {
  const supabase = createAdminClient();

  // 1. Perfil
  const { data: perfil, error: perfilError } = await supabase
    .from("perfiles_usuario")
    .select("*")
    .eq("id", userId)
    .single();

  if (perfilError || !perfil) return { profesional: null, error: perfilError?.message ?? "Perfil no encontrado" };

  // 2. Email desde auth
  const { data: { user } } = await supabase.auth.admin.getUserById(userId);
  const email = user?.email ?? "(sin email)";

  // 3. Pedidos del profesional
  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id, estado, total, metodo_pago, tipo_precio, created_at")
    .eq("usuario_id", userId)
    .order("created_at", { ascending: false });

  const totalGastado = (pedidos ?? []).reduce((sum, p) => sum + (p.total ?? 0), 0);

  return {
    profesional: {
      ...perfil,
      email,
      pedidos: pedidos ?? [],
      totalGastado,
      totalPedidos: (pedidos ?? []).length,
    },
    error: null,
  };
}
