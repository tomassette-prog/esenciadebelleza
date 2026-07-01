"use server";

import { cookies } from "next/headers";
import { createClient as createSupabase } from "@supabase/supabase-js";

const ADMIN_EMAILS = ["ziarresamot@gmail.com"];

function adminClient() {
  return createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function verificarAdmin() {
  try {
    const cookieStore = await cookies();
    const cookieName = `sb-yjanobsfzcwpusynvlun-auth-token`;
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
      const payload = JSON.parse(Buffer.from(parsed.access_token.split(".")[1], "base64url").toString());
      if (payload.sub && payload.exp * 1000 > Date.now() && ADMIN_EMAILS.includes(payload.email)) return;
    }
  } catch { /* ignorar */ }
  throw new Error("No autorizado");
}

export async function guardarMapeoCategoria(data: {
  woo_cat_id: number;
  woo_cat_name: string | null;
  categoria: string;
  subcategoria: string;
}): Promise<{ ok?: boolean; error?: string }> {
  await verificarAdmin();
  const supa = adminClient();
  const { error } = await supa.from("woo_cat_mappings").upsert(data, { onConflict: "woo_cat_id" });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function eliminarMapeoCategoria(woo_cat_id: number): Promise<{ ok?: boolean; error?: string }> {
  await verificarAdmin();
  const supa = adminClient();
  const { error } = await supa.from("woo_cat_mappings").delete().eq("woo_cat_id", woo_cat_id);
  if (error) return { error: error.message };
  return { ok: true };
}
