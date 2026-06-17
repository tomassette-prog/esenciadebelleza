import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const authCookies = allCookies.filter(c => c.name.includes("supabase") || c.name.includes("sb-"));

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

  const { data: { user }, error } = await supabase.auth.getUser();
  const { data: { session } } = await supabase.auth.getSession();

  return NextResponse.json({
    totalCookies: allCookies.length,
    authCookieNames: authCookies.map(c => c.name),
    user: user ? { id: user.id, email: user.email } : null,
    session: session ? { expires_at: session.expires_at } : null,
    error: error?.message,
  });
}
