import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Auth for internal cron endpoints. Vercel cron sends
 * `Authorization: Bearer $CRON_SECRET`; a manual run can send `x-mirror-token`
 * matching config_tienda.imagen_mirror_token. When that row does not exist the
 * manual path is disabled.
 */
export async function estaAutorizado(req: NextRequest, supabase: SupabaseClient): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (cronSecret && auth === "Bearer " + cronSecret) return true;

  const tokenManual = req.headers.get("x-mirror-token");
  if (!tokenManual) return false;
  const { data } = await supabase
    .from("config_tienda")
    .select("valor")
    .eq("clave", "imagen_mirror_token")
    .maybeSingle();
  return !!data?.valor && data.valor === tokenManual;
}
