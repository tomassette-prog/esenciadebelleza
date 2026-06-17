import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const authCookies = allCookies.filter(c => c.name.includes("supabase") || c.name.includes("sb-"));

  // Intento 1: createServerClient normal
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  // Intento 2: parsear el token manualmente con el admin client
  let manualUser = null;
  const authCookie = authCookies.find(c => c.name.includes("auth-token"));
  if (authCookie) {
    try {
      const parsed = JSON.parse(authCookie.value);
      const accessToken = parsed.access_token;
      const refreshToken = parsed.refresh_token;
      
      if (accessToken) {
        // Decodificar el JWT manualmente (sin verificar firma)
        const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString());
        manualUser = { id: payload.sub, email: payload.email, role: payload.role };
        
        // También intentar con el admin client
        const admin = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );
        const { data: { user: adminUser } } = await admin.auth.admin.getUserById(payload.sub);
        manualUser = { ...manualUser, adminVerified: adminUser?.email };
      }
    } catch (e) {
      manualUser = { error: String(e) };
    }
  }

  return NextResponse.json({
    totalCookies: allCookies.length,
    authCookies: authCookies.map(c => ({ name: c.name, valueLen: c.value.length, valueStart: c.value.slice(0, 80) })),
    sessionFromSSR: session ? { user: session.user.email } : null,
    sessionError: sessionError?.message,
    manualUser,
  });
}
