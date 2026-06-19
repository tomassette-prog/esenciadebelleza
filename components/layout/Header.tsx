import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { BotonesCarritoHeader } from "@/components/carrito/BotonesCarritoHeader";
import { LogoEsencia } from "@/components/layout/LogoEsencia";
import { NavMegaMenu } from "@/components/layout/NavMegaMenu";
import { LogoutBtn } from "@/components/layout/LogoutBtn";

const ADMIN_EMAILS = ["ziarresamot@gmail.com"];

// Lee el email del usuario directamente desde la cookie del browser client
async function getUserFromCookie(): Promise<{ id: string; email: string } | null> {
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

export async function Header() {
  // Primero intenta con el server client, si falla usa la cookie directamente
  let userId: string | null = null;
  let userEmail: string | null = null;
  let perfil: { nombre_completo: string | null; tipo_cliente: string } | null = null;

  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      userEmail = user.email ?? null;
      const { data } = await supabase
        .from("perfiles_usuario")
        .select("nombre_completo, tipo_cliente")
        .eq("id", user.id)
        .single();
      perfil = data;
    }
  } catch { /* ignorar */ }

  // Fallback: leer cookie directamente
  if (!userId) {
    const cookieUser = await getUserFromCookie();
    if (cookieUser) {
      userId = cookieUser.id;
      userEmail = cookieUser.email;
      // Obtener perfil con admin client
      try {
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );
        const { data } = await adminClient
          .from("perfiles_usuario")
          .select("nombre_completo, tipo_cliente")
          .eq("id", userId)
          .single();
        perfil = data;
      } catch { /* ignorar */ }
    }
  }

  const nombre = perfil?.nombre_completo?.split(" ")[0] ?? userEmail?.split("@")[0] ?? null;
  const esProfesional = perfil?.tipo_cliente === "b2b";
  const esAdmin = ADMIN_EMAILS.includes(userEmail ?? "");

  return (
    <header className="border-b border-neutral-100 bg-white sticky top-0 z-40">
      <div className="container-main relative">
        {/* Top bar */}
        <div className="flex items-center justify-between py-4">
          {/* Logo */}
          <Link href="/" className="flex flex-col leading-none" aria-label="Esencia de Belleza - Inicio">
            <span style={{
              fontFamily: "var(--font-cormorant), 'Cormorant Garamond', Georgia, serif",
              fontSize: "clamp(18px, 2.5vw, 26px)",
              fontWeight: 400,
              letterSpacing: "0.02em",
              lineHeight: 1.1,
            }}>
              <span style={{ color: "#3D2018" }}>esencia</span>
              <span style={{ color: "#C4857A", fontStyle: "italic", fontWeight: 600 }}>de</span>
              <span style={{ color: "#3D2018" }}>belleza</span>
              <span style={{ color: "#C4857A" }}>.es</span>
            </span>
            <span style={{
              fontFamily: "var(--font-inter), sans-serif",
              fontSize: "9px",
              fontWeight: 300,
              letterSpacing: "0.22em",
              color: "#C4857A",
              marginTop: "3px",
              textTransform: "uppercase",
            }}>
              Peluquería · Estética · Perfumes
            </span>
          </Link>

          {/* Acciones */}
          <div className="flex items-center gap-1">
            {/* Buscar */}
            <Link
              href="/buscar"
              className="p-2 text-neutral-500 hover:text-neutral-900 transition-colors"
              aria-label="Buscar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </Link>

            {/* Cuenta */}
            {userId ? (
              <>
                {esAdmin && (
                  <Link
                    href="/admin/productos"
                    className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs tracking-wider uppercase text-neutral-500 hover:text-neutral-900 transition-colors"
                    aria-label="Panel Admin"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                    Admin
                  </Link>
                )}
                <Link
                  href="/cuenta"
                  className="flex items-center gap-2 px-3 py-2 text-neutral-500 hover:text-neutral-900 transition-colors"
                  aria-label="Mi cuenta"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  <span className="hidden sm:block text-xs">
                    {esProfesional && (
                      <span className="text-[#C4857A] font-medium mr-1">PRO</span>
                    )}
                    {nombre}
                  </span>
                </Link>
                <LogoutBtn />
              </>
            ) : (
              <Link
                href="/login"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs tracking-wider uppercase text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                Entrar
              </Link>
            )}

            {/* Carrito */}
            <BotonesCarritoHeader />
          </div>
        </div>

        {/* Navegación — mega menu (desktop) + drawer (mobile) */}
        <NavMegaMenu />
      </div>
    </header>
  );
}
