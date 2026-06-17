import Link from "next/link";

const CATEGORIAS = [
  { label: "Peluquería", href: "/productos/peluqueria" },
  { label: "Estética", href: "/productos/estetica" },
  { label: "Perfumería", href: "/productos/perfumeria" },
  { label: "Marcas", href: "/marcas" },
];

const INFO = [
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
            <p className="text-xs text-neutral-300 tracking-widest uppercase">
              Envíos a toda España · Pago seguro
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
