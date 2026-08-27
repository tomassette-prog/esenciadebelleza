import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Endpoint temporal de diagnóstico — ELIMINAR después de resolver el issue
export async function GET() {
  const cookieStore = await cookies();
  const all = cookieStore.getAll();

  const supabaseCookies = all.filter(c => c.name.startsWith("sb-"));

  const info = supabaseCookies.map(c => {
    let decoded = "";
    let email = "";
    try {
      const raw = c.value.startsWith("%") ? decodeURIComponent(c.value) : c.value;
      const parsed = JSON.parse(raw);
      email = parsed?.user?.email ?? parsed?.email ?? "(not found)";
      decoded = "OK";
    } catch (e: unknown) {
      decoded = `parse error: ${e instanceof Error ? e.message : String(e)}`;
    }
    return {
      name: c.name,
      length: c.value.length,
      first20: c.value.substring(0, 20),
      decoded,
      email,
    };
  });

  return NextResponse.json({
    totalCookies: all.length,
    supabaseCookies: info,
    allCookieNames: all.map(c => c.name),
  });
}
