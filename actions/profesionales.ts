"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAILS = ["ziarresamot@gmail.com"];

async function verificarAdmin() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && ADMIN_EMAILS.includes(user.email ?? "")) return user;
  } catch { /* ignorar */ }

  try {
    const cookieStore = await cookies();
    const projectRef = "yjanobsfzcwpusynvlun";
    const cookieName = `sb-${projectRef}-auth-token`;
    let tokenValue = cookieStore.get(cookieName)?.value;
    if (!tokenValue) {
      let combined = "";
      for (let i = 0; i < 5; i++) {
        const chunk = cookieStore.get(`${cookieName}.${i}`)?.value;
        if (!chunk) break;
        combined += chunk;
      }
      if (combined) tokenValue = combined;
    }
    if (!tokenValue) return null;
    const parsed = JSON.parse(tokenValue);
    const accessToken: string = parsed.access_token;
    if (!accessToken) return null;
    const payloadB64 = accessToken.split(".")[1];
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    const userId: string = payload.sub;
    if (!userId) return null;
    const admin = createAdminClient();
    const { data: { user } } = await admin.auth.admin.getUserById(userId);
    if (user && ADMIN_EMAILS.includes(user.email ?? "")) return user;
    return null;
  } catch {
    return null;
  }
}

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
