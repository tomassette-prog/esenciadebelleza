import Link from "next/link";

const CATEGORIAS = [
  { label: "Peluquería", href: "/productos/peluqueria" },
  { label: "Estética", href: "/productos/estetica" },
  { label: "Perfumería", href: "/productos/perfumeria" },
  { label: "Marcas", href: "/marcas" },
];

const INFO = [
  { label: "Área profesional", href: "/profesionales" },
  { label: "Sobre nosotros", href: "/sobre-nosotros" },
  { label: "Política de envíos", href: "/envios" },
  { label: "Devoluciones", href: "/devoluciones" },
  { label: "Aviso legal", href: "/aviso-legal" },
  { label: "Privacidad", href: "/privacidad" },
  { label: "Cookies", href: "/cookies" },
];

export function Footer() {
  return (
    <footer className="border-t border-neutral-100 bg-white mt-16">
      {/* Barra de confianza */}
      <div className="border-b border-neutral-100 bg-neutral-50">
        <div className="container-main py-4">
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12 text-xs tracking-widest uppercase text-neutral-500">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
              Envíos a Península y Baleares · No Canarias, Ceuta, Melilla ni Andorra
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
              Pago 100% seguro
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
              Atención al cliente
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
              Productos profesionales
            </span>
          </div>
        </div>
      </div>
      <div className="container-main py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Marca */}
          <div className="space-y-3">
            <h3
              className="text-lg font-light text-neutral-900"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Esencia de Belleza
            </h3>
            <p className="text-sm text-neutral-400 leading-relaxed max-w-xs">
              Productos profesionales de peluquería, estética y perfumería.
              Precios especiales para profesionales del sector.
            </p>
            <p className="text-xs text-neutral-400 leading-relaxed">
              No realizamos envíos a Canarias, Ceuta, Melilla, Andorra ni Gibraltar.
            </p>
          </div>

          {/* Categorías + Info juntos */}
          <div className="md:col-span-2 grid grid-cols-2 gap-8">
            <div>
              <h4 className="text-xs tracking-widest uppercase text-neutral-900 mb-3">
                Categorías
              </h4>
              <ul className="space-y-1.5">
                {CATEGORIAS.map((c) => (
                  <li key={c.href}>
                    <Link href={c.href} className="text-sm text-neutral-400 hover:text-neutral-900 transition-colors">
                      {c.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs tracking-widest uppercase text-neutral-900 mb-3">
                Información
              </h4>
              <ul className="space-y-1.5">
                {INFO.map((c) => (
                  <li key={c.href}>
                    <Link href={c.href} className="text-sm text-neutral-400 hover:text-neutral-900 transition-colors">
                      {c.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-neutral-100 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-neutral-400">
            © {new Date().getFullYear()} Esencia de Belleza · esenciadebelleza.es
          </p>
          <div className="flex items-center gap-4 text-neutral-300">
            <span className="text-xs tracking-wide">Visa</span>
            <span className="text-xs tracking-wide">Mastercard</span>
            <span className="text-xs tracking-wide">PayPal</span>
            <span className="text-xs tracking-wide">Bizum</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
