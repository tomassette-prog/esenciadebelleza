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
  return {};
}
