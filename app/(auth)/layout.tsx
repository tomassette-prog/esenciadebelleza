import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex">

      {/* ── Panel izquierdo — imagen con overlay ── */}
      <div
        className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative flex-col justify-between p-12"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1400&q=80&auto=format&fit=crop')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Overlay oscuro */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, rgba(10,10,10,0.80) 0%, rgba(10,10,10,0.55) 100%)" }}
          aria-hidden="true"
        />

        {/* Logo */}
        <Link href="/" className="relative z-10 inline-flex flex-col leading-none" aria-label="Volver al inicio">
          <span
            className="text-3xl font-light text-white tracking-tight"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            Esencia de Belleza
          </span>
          <span className="text-[10px] tracking-[0.3em] uppercase mt-1" style={{ color: "var(--color-oro-light, #D4AF6A)" }}>
            Peluquería · Estética · Perfumería
          </span>
        </Link>

        {/* Claim inferior */}
        <div className="relative z-10">
          <div className="w-10 h-px mb-4" style={{ backgroundColor: "var(--color-oro, #C9A84C)" }} />
          <p className="text-white/80 text-sm leading-relaxed max-w-xs font-light">
            Productos profesionales de belleza con precios para particulares y tarifas exclusivas para profesionales del sector.
          </p>
          <Link
            href="/profesionales"
            className="inline-block mt-4 text-xs tracking-widest uppercase border-b pb-0.5 text-white/60 hover:text-white transition-colors"
            style={{ borderColor: "var(--color-oro, #C9A84C)" }}
          >
            Soy profesional →
          </Link>
        </div>
      </div>

      {/* ── Panel derecho — formulario ── */}
      <div className="flex-1 flex flex-col bg-white">

        {/* Logo móvil (solo visible en mobile) */}
        <div className="lg:hidden px-6 pt-6">
          <Link href="/" className="inline-flex flex-col leading-none">
            <span
              className="text-2xl font-light text-neutral-900"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Esencia de Belleza
            </span>
            <span className="text-[10px] tracking-[0.25em] uppercase text-neutral-400 mt-0.5">
              Peluquería · Estética · Perfumería
            </span>
          </Link>
        </div>

        {/* Contenido centrado verticalmente */}
        <main className="flex-1 flex items-center justify-center px-6 py-10">
          {children}
        </main>

        {/* Footer mínimo */}
        <footer className="px-6 py-4 text-center text-xs text-neutral-400 border-t border-neutral-100">
          © {new Date().getFullYear()} Esencia de Belleza ·{" "}
          <Link href="/privacidad" className="hover:text-neutral-600 transition-colors">
            Privacidad
          </Link>
        </footer>
      </div>
    </div>
  );
}
