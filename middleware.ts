import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ─── Patrones de rutas legacy/maliciosas que deben bloquearse ────────────────
const LEGACY_BLOCK_PATTERNS: RegExp[] = [
  /\.(php|asp|aspx|jsp|cgi|pl|py|rb|sh|env|git|svn|htaccess|htpasswd|DS_Store)$/i,
  /\/wp-admin/i,
  /\/wp-login/i,
  /\/wp-content/i,
  /\/wp-includes/i,
  /\/xmlrpc/i,
  /\/administrator/i,
  /\/phpmyadmin/i,
  /\/cgi-bin/i,
  /\/etc\/passwd/i,
  /\/proc\/self/i,
  /\.\.\//, // path traversal
  /\/(config|setup|install|backup|dump|db)\.(sql|zip|tar|gz|rar)$/i,
];

// ─── Rutas que requieren sesión activa ───────────────────────────────────────
const PROTECTED_ROUTES = ["/cuenta", "/admin"];

// ─── Rutas exclusivas de admin ───────────────────────────────────────────────
const ADMIN_ROUTES = ["/admin"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Bloquear rutas maliciosas / legacy con 410 Gone
  for (const pattern of LEGACY_BLOCK_PATTERNS) {
    if (pattern.test(pathname)) {
      return new NextResponse(null, {
        status: 410,
        headers: { "X-Robots-Tag": "noindex" },
      });
    }
  }

  // 2. Bloquear User-Agents de scanners conocidos
  const ua = request.headers.get("user-agent") ?? "";
  const maliciousUA = /sqlmap|nikto|nmap|masscan|zgrab|dirbuster|gobuster|wfuzz/i;
  if (maliciousUA.test(ua)) {
    return new NextResponse(null, { status: 403 });
  }

  // 3. Gestión de autenticación con Supabase SSR
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Sin credenciales de Supabase: bloquear rutas protegidas
    const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
    if (isProtected) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refrescar sesión (no bloquea la ejecución)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 4. Proteger rutas de cuenta y checkout
  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 5. Proteger rutas de administración — solo rol 'admin'
  const isAdminRoute = ADMIN_ROUTES.some((r) => pathname.startsWith(r));
  if (isAdminRoute) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    // Verificar rol en metadata del usuario
    const role = user.user_metadata?.role ?? user.app_metadata?.role;
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Excluir archivos estáticos de Next.js y assets públicos,
     * pero procesar TODAS las demás rutas (incluyendo API)
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|images/).*)",
  ],
};
