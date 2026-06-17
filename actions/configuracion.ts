"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const ADMIN_EMAILS = ["ziarresamot@gmail.com"];

async function verificarAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email ?? "")) redirect("/login");
  return user;
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
