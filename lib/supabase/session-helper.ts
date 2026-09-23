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

  try {
    const decoded = raw.startsWith("%") ? decodeURIComponent(raw) : raw;
    const parsed = JSON.parse(decoded);
    const token: string | undefined = parsed?.access_token;
    if (!token) return null;

    // Verificación real: firma + expiración contra el servidor de auth
    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user?.email) return null;

    return { id: data.user.id, email: data.user.email };
  } catch {
    return null;
  }
}
