import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const PROJECT_REF = "yjanobsfzcwpusynvlun";

/**
 * Lee la sesión de Supabase desde la cookie (soporta cookies troceadas) y
 * VERIFICA el JWT contra Supabase Auth.
 *
 * NUNCA confiar en el JSON plano de la cookie: cualquiera puede fabricarla.
 * La identidad solo se acepta si `auth.getUser(token)` valida firma y expiración.
 */
export async function getSessionFromCookie(): Promise<{
  id: string;
  email: string;
} | null> {
  const cookieStore = await cookies();
  const cookieName = `sb-${PROJECT_REF}-auth-token`;

  let raw = cookieStore.get(cookieName)?.value ?? "";
  if (!raw) {
    for (let i = 0; ; i++) {
      const chunk = cookieStore.get(`${cookieName}.${i}`)?.value;
      if (!chunk) break;
      raw += chunk;
    }
  }
  if (!raw) return null;

  let accessToken: string | null = null;
  try {
    const decoded = raw.startsWith("%") ? decodeURIComponent(raw) : raw;
    const parsed = JSON.parse(decoded);
    accessToken = parsed?.access_token ?? null;
  } catch {
    return null;
  }
  if (!accessToken) return null;

  // Verificar la firma del JWT contra Supabase: NUNCA confiar en el JSON de la cookie
  // (un JSON forjado daría acceso como cualquier usuario, incluido el admin)
  const admin = createAdminClient();
  const { data: { user }, error } = await admin.auth.getUser(accessToken);
  if (error || !user?.id || !user.email) return null;

  return { id: user.id, email: user.email };
}
