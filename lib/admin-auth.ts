import { getSessionFromCookie } from "@/lib/supabase/session-helper";

const ADMIN_EMAILS = ["ziarresamot@gmail.com"];

/**
 * Verifica que la sesión autenticada (JWT verificado contra Supabase en
 * getSessionFromCookie) pertenezca al administrador. Lanza si no lo es.
 */
export async function verificarAdmin(): Promise<{ email: string }> {
  const session = await getSessionFromCookie();
  if (!session || !ADMIN_EMAILS.includes(session.email)) {
    throw new Error("No autorizado");
  }
  return { email: session.email };
}

/**
 * Autorización para rutas API: sesión de admin verificada o bearer con
 * CRON_SECRET (scripts de automatización). Devuelve true/false sin lanzar.
 */
export async function autorizarAdminOSecreto(authorization: string | null): Promise<boolean> {
  const secreto = process.env.CRON_SECRET;
  if (secreto && authorization === `Bearer ${secreto}`) return true;
  try {
    await verificarAdmin();
    return true;
  } catch {
    return false;
  }
}
