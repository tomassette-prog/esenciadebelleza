"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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
    if (tokenValue) {
      const parsed = JSON.parse(tokenValue);
      const accessToken: string = parsed.access_token;
      if (accessToken) {
        const payloadB64 = accessToken.split(".")[1];
        const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
        if (payload.sub && payload.exp * 1000 > Date.now() && ADMIN_EMAILS.includes(payload.email)) {
          return { id: payload.sub, email: payload.email };
        }
      }
    }
  } catch { /* ignorar */ }

  redirect("/login");
}

export async function getConfigTienda(): Promise<Record<string, string>> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("config_tienda").select("clave, valor");
  const config: Record<string, string> = {};
  for (const row of data ?? []) {
    config[row.clave] = row.valor;
  }
  return config;
}

export async function actualizarConfigTienda(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  await verificarAdmin();
  const supabase = createAdminClient();

  const campos = [
    "envio_gratis_desde",
    "envio_coste",
    "precio_multiplicador_b2c",
    "precio_multiplicador_b2b",
  ];

  for (const clave of campos) {
    const valor = formData.get(clave);
    if (valor !== null) {
      const { error } = await supabase
        .from("config_tienda")
        .upsert({ clave, valor: String(valor) }, { onConflict: "clave" });
      if (error) return { ok: false, error: `Error actualizando ${clave}: ${error.message}` };
    }
  }

  revalidatePath("/admin/envios");
  revalidatePath("/");
  return { ok: true };
}
