"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarAdmin } from "@/lib/admin-auth";

export async function aprobarProfesional(
  userId: string
): Promise<{ error?: string }> {
  const admin_user = await verificarAdmin();
  if (!admin_user) return { error: "No autorizado" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("perfiles_usuario")
    .update({ b2b_aprobado: true })
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
