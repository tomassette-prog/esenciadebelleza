import { cookies } from "next/headers";

/**
 * Lee el usuario autenticado directamente desde la cookie de Supabase.
 * Fallback cuando supabase.auth.getUser() no funciona (token refresh, etc.)
 */
export async function getUserFromCookie(): Promise<{ id: string; email: string } | null> {
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

    if (!payload.sub || payload.exp * 1000 < Date.now()) return null;

    return { id: payload.sub, email: payload.email ?? "" };
  } catch {
    return null;
  }
}
