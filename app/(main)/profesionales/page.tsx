import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Área Profesional | Esencia de Belleza",
  description:
    "Precios exclusivos para peluquerías, centros de estética, barberías y clínicas de belleza. Regístrate como profesional y accede a tarifas especiales en todo el catálogo.",
  alternates: { canonical: "https://esenciadebelleza.es/profesionales" },
};

const VENTAJAS = [
  {
    titulo: "Precios de distribuidor",
    descripcion: "Accede a tarifas especiales en todos los productos del catálogo, con descuentos sobre el precio público.",
    icono: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z" />
      </svg>
    ),
  },
  {
    titulo: "Catálogo completo",
    descripcion: "Más de 3.000 referencias de las mejores marcas: Wella, L'Oréal, Fanola, Kerastase y muchas más.",
    icono: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
  {
    titulo: "Envío rápido",
    descripcion: "Entrega en 24-48h en Península y Baleares. Seguimiento de pedido en tiempo real.",
    icono: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
  },
  {
    titulo: "Atención personalizada",
    descripcion: "Equipo dedicado para profesionales. Consulta disponibilidad, novedades y gestiona tus pedidos.",
    icono: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    ),
  },
];

const PASOS = [
  {
    num: "01",
    titulo: "Crea tu cuenta profesional",
    descripcion: "Regístrate indicando el nombre de tu negocio y tu NIF/CIF. Es rápido y gratuito.",
  },
  {
    num: "02",
    titulo: "Verificamos tu solicitud",
    descripcion: "Nuestro equipo revisa tu solicitud en menos de 24 horas y activa los precios profesionales.",
  },
  {
    num: "03",
    titulo: "Compra con precios de profesional",
    descripcion: "Una vez aprobada tu cuenta, accede al catálogo completo con tarifas exclusivas.",
  },
];

export default function ProfesionalesPage() {
  return (
    <main>
      {/* ── Hero ── */}
      <section className="relative bg-neutral-900 py-24 px-6 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1562322140-8baeececf3df?w=1600&q=80&auto=format&fit=crop')",
          }}
        />
        <div className="relative container-main text-center">
          <p
            className="text-xs tracking-[0.4em] uppercase mb-4"
            style={{ color: "var(--color-oro)", fontFamily: "var(--font-inter)" }}
          >
            Para profesionales
          </p>
          <h1
            className="text-5xl lg:text-7xl font-light text-white mb-6"
            style={{ fontFamily: "var(--font-cormorant)", letterSpacing: "-0.02em" }}
          >
            Precios exclusivos<br />para tu negocio
          </h1>
          <div className="w-12 h-px mx-auto mb-6" style={{ backgroundColor: "var(--color-oro)" }} />
          <p className="text-neutral-300 text-base max-w-xl mx-auto mb-10 leading-relaxed">
            Peluquerías, centros de estética, barberías y clínicas de belleza.
            Accede a todo el catálogo con tarifas de distribuidor.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/registro?tipo=profesional"
              className="px-10 py-4 text-sm tracking-widest uppercase text-neutral-900 bg-white hover:bg-neutral-100 transition-colors font-medium"
            >
              Solicitar cuenta profesional
            </Link>
            <Link
              href="/login"
              className="px-10 py-4 text-sm tracking-widest uppercase text-white border border-white/30 hover:border-white transition-colors"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </section>

      {/* ── Ventajas ── */}
      <section className="py-20 px-6 bg-white">
        <div className="container-main">
          <div className="text-center mb-14">
            <h2
              className="text-3xl font-light text-neutral-900"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Todo lo que necesita tu negocio
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {VENTAJAS.map((v) => (
              <div key={v.titulo} className="flex flex-col gap-4">
                <div
                  className="w-12 h-12 flex items-center justify-center border"
                  style={{ borderColor: "var(--color-oro)", color: "var(--color-oro)" }}
                >
                  {v.icono}
                </div>
                <h3 className="text-lg font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
                  {v.titulo}
                </h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{v.descripcion}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section className="py-20 px-6 bg-neutral-50">
        <div className="container-main">
          <div className="text-center mb-14">
            <h2
              className="text-3xl font-light text-neutral-900"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Cómo funciona
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Línea conectora en desktop */}
            <div className="hidden md:block absolute top-8 left-1/4 right-1/4 h-px bg-neutral-200" />
            {PASOS.map((p) => (
              <div key={p.num} className="relative flex flex-col items-center text-center gap-4">
                <div
                  className="w-16 h-16 flex items-center justify-center bg-white border-2 text-2xl font-light z-10"
                  style={{ borderColor: "var(--color-oro)", fontFamily: "var(--font-cormorant)", color: "var(--color-oro)" }}
                >
                  {p.num}
                </div>
                <h3 className="text-lg font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
                  {p.titulo}
                </h3>
                <p className="text-sm text-neutral-500 leading-relaxed max-w-xs">{p.descripcion}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="py-20 px-6 bg-neutral-900">
        <div className="container-main text-center">
          <h2
            className="text-4xl font-light text-white mb-4"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            ¿Listo para empezar?
          </h2>
          <p className="text-neutral-400 text-sm mb-10 max-w-md mx-auto">
            Únete a los profesionales que ya confían en Esencia de Belleza para su negocio.
          </p>
          <Link
            href="/registro?tipo=profesional"
            className="inline-block px-12 py-4 text-sm tracking-widest uppercase text-neutral-900 bg-white hover:bg-neutral-100 transition-colors font-medium"
          >
            Solicitar cuenta profesional
          </Link>
        </div>
      </section>
    </main>
  );
}
