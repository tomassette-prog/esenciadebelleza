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

// ── Poner contraseña temporal ────────────────────────────────────────────────
export async function ponerPasswordTemporal(
  userId: string,
  password: string
): Promise<{ error?: string; success?: boolean }> {
  const admin_user = await verificarAdmin();
  if (!admin_user) return { error: "No autorizado" };

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) return { error: error.message };

  revalidatePath(`/admin/profesionales/${userId}`);
  revalidatePath(`/admin/clientes/${userId}`);
  return { success: true };
}

// ── Enviar email de reseteo de contraseña ────────────────────────────────────
export async function enviarResetPassword(
  userId: string
): Promise<{ error?: string; success?: boolean }> {
  const admin_user = await verificarAdmin();
  if (!admin_user) return { error: "No autorizado" };

  const supabase = createAdminClient();

  // Obtener email del usuario
  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !user?.email) return { error: "No se encontró el email del usuario." };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://esenciadebelleza.es";

  // Usar el cliente anónimo para enviar el reset (la admin API no tiene este método directo)
  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/cuenta/nueva-password`,
  });

  if (error) return { error: error.message };

  return { success: true };
}
