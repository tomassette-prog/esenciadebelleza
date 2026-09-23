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

// ─── Rutas que requieren sesión activa (solo /cuenta) ─────────────────────────
const PROTECTED_ROUTES = ["/cuenta"];

// /admin no se protege aquí — el layout app/admin/layout.tsx gestiona su propia auth

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

  // 3. Verificar sesión leyendo cookie directamente (mismo enfoque que admin layout)
  const response = NextResponse.next();
  const PROJECT_REF = "yjanobsfzcwpusynvlun";
  const cookieName = `sb-${PROJECT_REF}-auth-token`;
  let raw = request.cookies.get(cookieName)?.value ?? "";

  // Also try chunked cookies
  if (!raw) {
    let i = 0;
    while (true) {
      const chunk = request.cookies.get(`${cookieName}.${i}`)?.value;
      if (!chunk) break;
      raw += chunk;
      i++;
    }
  }

  let user: { id: string; email: string } | null = null;
  if (raw) {
    try {
      const decoded = raw.startsWith("%") ? decodeURIComponent(raw) : raw;
      const parsed = JSON.parse(decoded);
      const id = parsed?.user?.id;
      const email = parsed?.user?.email;
      if (id && email) user = { id, email };
    } catch { /* cookie corrupta */ }
  }

  // 4. Proteger rutas de cuenta
  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Nota: esta comprobación de cookie es SOLO UX (redirección temprana a login).
  // La autorización real se verifica en servidor contra Supabase Auth
  // (lib/supabase/session-helper.ts valida la firma del JWT).
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
