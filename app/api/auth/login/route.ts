import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let email = "", password = "", redirectTo = "/cuenta";
  
  try {
    // Los formularios HTML envían application/x-www-form-urlencoded
    const contentType = request.headers.get("content-type") ?? "";
    let params: URLSearchParams;
    
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      params = new URLSearchParams();
      formData.forEach((value, key) => params.set(key, value.toString()));
    } else {
      const body = await request.text();
      params = new URLSearchParams(body);
    }
    
    email = (params.get("email") ?? "").trim().toLowerCase();
    password = params.get("password") ?? "";
    redirectTo = params.get("redirectTo") || "/cuenta";
    console.log("[login] email:", email, "redirectTo:", redirectTo, "contentType:", contentType.slice(0, 50));
  } catch (e) {
    console.error("[login] parse error:", e);
    return NextResponse.redirect(new URL("/login?error=form", request.url), { status: 302 });
  }

  const cookieStore = await cookies();
  const response = NextResponse.redirect(new URL(redirectTo, request.url), {
    status: 302,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  console.log("[login] result:", error ? `error: ${error.message}` : `user: ${data?.user?.email}`);

  if (error) {
    console.error("[login] signInWithPassword error:", error.message, error.status);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "credenciales");
    if (redirectTo !== "/cuenta") loginUrl.searchParams.set("redirectTo", redirectTo);
    return NextResponse.redirect(loginUrl, { status: 302 });
  }

  console.log("[login] redirecting to:", redirectTo);
  return response;
}
