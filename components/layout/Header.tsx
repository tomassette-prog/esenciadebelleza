import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BotonesCarritoHeader } from "@/components/carrito/BotonesCarritoHeader";

const MENU = [
  { label: "Peluquería", href: "/productos/peluqueria" },
  { label: "Estética",   href: "/productos/estetica"   },
  { label: "Perfumería", href: "/productos/perfumeria" },
  { label: "Marcas",     href: "/marcas"               },
];

export async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Obtener perfil solo si hay usuario (para saber si es B2B)
  let perfil: { nombre_completo: string | null; tipo_cliente: string } | null = null;
  if (user) {
    const { data } = await supabase
      .from("perfiles_usuario")
      .select("nombre_completo, tipo_cliente")
      .eq("id", user.id)
      .single();
    perfil = data;
  }

  const nombre = perfil?.nombre_completo?.split(" ")[0] ?? user?.email?.split("@")[0] ?? null;
  const esProfesional = perfil?.tipo_cliente === "b2b";

  return (
    <header className="border-b border-neutral-100 bg-white sticky top-0 z-40">
      <div className="container-main">
        {/* Top bar */}
        <div className="flex items-center justify-between py-4">
          {/* Logo */}
          <Link href="/" className="flex flex-col leading-none">
            <span
              className="text-2xl font-light tracking-tight text-neutral-900"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Esencia de Belleza
            </span>
            <span className="text-[10px] tracking-[0.25em] uppercase text-neutral-400">
              Peluquería · Estética · Perfumería
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
            {user ? (
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
                    <span className="text-[#C9A84C] font-medium mr-1">PRO</span>
                  )}
                  {nombre}
                </span>
              </Link>
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

        {/* Navegación */}
        <nav className="hidden md:flex items-center gap-8 pb-3">
          {MENU.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs tracking-widest uppercase text-neutral-500 hover:text-neutral-900 transition-colors pb-1 border-b border-transparent hover:border-neutral-900"
            >
              {item.label}
            </Link>
          ))}
          <span className="ml-auto">
            <Link
              href="/profesionales"
              className="text-xs tracking-widest uppercase px-4 py-2 border border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white transition-colors"
            >
              Área Profesional
            </Link>
          </span>
        </nav>
      </div>
    </header>
  );
}
