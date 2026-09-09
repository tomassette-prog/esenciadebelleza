import { cookies, headers } from "next/headers";

/**
 * Lee el usuario autenticado directamente desde la cookie de Supabase.
 * Fallback cuando supabase.auth.getUser() no funciona (token refresh, etc.)
 */
export async function getUserFromCookie(): Promise<{ id: string; email: string } | null> {
  try {
    const projectRef = "yjanobsfzcwpusynvlun";
    const cookieName = `sb-${projectRef}-auth-token`;

    // Intento 1: cookies() API
    let tokenValue: string | null = null;
    try {
      const cookieStore = await cookies();
      tokenValue = cookieStore.get(cookieName)?.value ?? null;
      if (!tokenValue) {
        let combined = "";
        for (let i = 0; i < 5; i++) {
          const chunk = cookieStore.get(`${cookieName}.${i}`)?.value;
          if (!chunk) break;
          combined += chunk;
        }
        if (combined) tokenValue = combined;
      }
    } catch { /* ignorar */ }

    // Intento 2: headers — parse manual
    if (!tokenValue) {
      try {
        const hdrs = await headers();
        const cookieHeader = hdrs.get("cookie") ?? "";
        const match = cookieHeader.match(new RegExp(`${cookieName}=([^;]+)`));
        if (match) tokenValue = decodeURIComponent(match[1]);
        if (!tokenValue) {
          let combined = "";
          for (let i = 0; i < 5; i++) {
            const re = new RegExp(`${cookieName}\\.${i}=([^;]+)`);
            const m = cookieHeader.match(re);
            if (!m) break;
            combined += decodeURIComponent(m[1]);
          }
          if (combined) tokenValue = combined;
        }
      } catch { /* ignorar */ }
    }

    if (!tokenValue) return null;

    const parsed = JSON.parse(tokenValue);
    const accessToken: string = parsed.access_token;
    if (!accessToken) return null;

    const payloadB64 = accessToken.split(".")[1];
    // Decode base64url — compatible con edge y node
    const base64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = typeof Buffer !== "undefined"
      ? Buffer.from(base64, "base64").toString()
      : atob(base64);
    const payload = JSON.parse(jsonPayload);

    if (!payload.sub || payload.exp * 1000 < Date.now()) return null;

    return { id: payload.sub, email: payload.email ?? "" };
  } catch {
    return null;
  }
}
