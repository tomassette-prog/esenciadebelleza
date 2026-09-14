import { cookies } from "next/headers";

const PROJECT_REF = "yjanobsfzcwpusynvlun";

/**
 * Lee la sesión de Supabase directamente de la cookie (mismo enfoque que admin layout).
 * Más robusto que supabase.auth.getSession() que falla en middleware/SSR.
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
    const id = parsed?.user?.id;
    const email = parsed?.user?.email;
    if (id && email) return { id, email };
    return null;
  } catch {
    return null;
  }
}
