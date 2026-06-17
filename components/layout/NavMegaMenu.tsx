"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, type NavItem } from "@/lib/categorias";

export function NavMegaMenu() {
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandidoMobile, setExpandidoMobile] = useState<string | null>(null);
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cerrar todo al cambiar de ruta
  useEffect(() => {
    setMenuAbierto(null);
    setMobileOpen(false);
    setExpandidoMobile(null);
  }, [pathname]);

  // Bloquear scroll del body cuando el menú mobile está abierto
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const handleMouseEnter = (href: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMenuAbierto(href);
  };

  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => setMenuAbierto(null), 120);
  };

  const itemActivo = NAV_ITEMS.find((i) => i.href === menuAbierto && i.columnas);

  return (
    <>
      {/* ─────────────────── DESKTOP NAV ─────────────────────────── */}
      <nav
        className="hidden md:flex items-center gap-0.5 pb-3"
        onMouseLeave={handleMouseLeave}
      >
        {NAV_ITEMS.map((item) =>
          item.columnas ? (
            <div
              key={item.href}
              onMouseEnter={() => handleMouseEnter(item.href)}
            >
              <button
                className={`flex items-center gap-1 px-3 py-1.5 text-xs tracking-widest uppercase transition-colors ${
                  menuAbierto === item.href
                    ? "text-neutral-900"
                    : "text-neutral-500 hover:text-neutral-900"
                }`}
                aria-expanded={menuAbierto === item.href}
              >
                {item.label}
                <svg
                  className={`w-3 h-3 transition-transform duration-200 ${
                    menuAbierto === item.href ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-1.5 text-xs tracking-widest uppercase text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              {item.label}
            </Link>
          )
        )}

        <span className="ml-auto">
          <Link
            href="/profesionales"
            className="text-xs tracking-widest uppercase px-4 py-2 border border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white transition-colors"
          >
            Área Profesional
          </Link>
        </span>
      </nav>

      {/* ─────────────────── MEGA DROPDOWN (desktop) ─────────────── */}
      {itemActivo && (
        <div
          className="absolute left-0 right-0 bg-white border-t border-neutral-100 shadow-2xl z-50"
          onMouseEnter={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
          }}
          onMouseLeave={handleMouseLeave}
        >
          <div className="py-8 px-4">
            <div className="grid grid-cols-4 gap-10">
              {itemActivo.columnas!.map((col) => (
                <div key={col.titulo}>
                  <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-neutral-400 mb-4">
                    {col.titulo}
                  </p>
                  <ul className="space-y-2.5">
                    {col.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors hover:underline underline-offset-2"
                          onClick={() => setMenuAbierto(null)}
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Footer del dropdown */}
            <div className="mt-7 pt-5 border-t border-neutral-100 flex items-center justify-between">
              <Link
                href={itemActivo.href}
                className="text-xs tracking-widest uppercase text-neutral-900 hover:text-neutral-500 transition-colors flex items-center gap-2 group"
                onClick={() => setMenuAbierto(null)}
              >
                Ver todo en {itemActivo.label}
                <svg
                  className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </Link>
              <Link
                href="/marcas"
                className="text-xs tracking-widest uppercase text-neutral-400 hover:text-neutral-900 transition-colors"
                onClick={() => setMenuAbierto(null)}
              >
                Todas las marcas →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────── MOBILE: barra inferior de nav ───────── */}
      <div className="md:hidden flex items-center justify-between pb-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 text-xs tracking-widest uppercase text-neutral-500 hover:text-neutral-900 transition-colors py-1.5"
          aria-expanded={mobileOpen}
          aria-label="Abrir menú"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
          Menú
        </button>
        <Link
          href="/profesionales"
          className="text-xs tracking-widest uppercase text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          Área Profesional
        </Link>
      </div>

      {/* ─────────────────── MOBILE DRAWER ───────────────────────── */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Panel lateral */}
          <div
            className="fixed inset-y-0 left-0 w-[85vw] max-w-sm bg-white z-50 flex flex-col overflow-y-auto md:hidden shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
          >
            {/* Cabecera del drawer */}
            <div className="flex items-center justify-between px-5 py-5 border-b border-neutral-100 shrink-0">
              <span
                className="text-sm tracking-[0.2em] uppercase font-light text-neutral-700"
                style={{ fontFamily: "var(--font-cormorant)" }}
              >
                Esencia de Belleza
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-900 transition-colors"
                aria-label="Cerrar menú"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Ítems del menú */}
            <nav className="flex-1 px-5 py-4">
              {NAV_ITEMS.map((item) => (
                <div key={item.href} className="border-b border-neutral-50 last:border-0">
                  {item.columnas ? (
                    <>
                      {/* Categoría con subcategorías → acordeón */}
                      <button
                        className="w-full flex items-center justify-between py-4 text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
                        onClick={() =>
                          setExpandidoMobile(
                            expandidoMobile === item.href ? null : item.href
                          )
                        }
                        aria-expanded={expandidoMobile === item.href}
                      >
                        {item.label}
                        <svg
                          className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${
                            expandidoMobile === item.href ? "rotate-180" : ""
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {expandidoMobile === item.href && (
                        <div className="pb-4 pl-1 space-y-5">
                          {item.columnas.map((col) => (
                            <div key={col.titulo}>
                              <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-neutral-400 mb-2.5">
                                {col.titulo}
                              </p>
                              <ul className="space-y-2">
                                {col.links.map((link) => (
                                  <li key={link.href}>
                                    <Link
                                      href={link.href}
                                      className="block text-sm text-neutral-600 hover:text-neutral-900 transition-colors py-0.5"
                                      onClick={() => setMobileOpen(false)}
                                    >
                                      {link.label}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                          {/* Ver todo */}
                          <Link
                            href={item.href}
                            className="inline-flex items-center gap-1.5 text-xs tracking-widest uppercase text-neutral-900 hover:text-neutral-500 transition-colors mt-1"
                            onClick={() => setMobileOpen(false)}
                          >
                            Ver todo en {item.label}
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17 8l4 4m0 0l-4 4m4-4H3"
                              />
                            </svg>
                          </Link>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Enlace directo (Marcas) */
                    <Link
                      href={item.href}
                      className="flex items-center py-4 text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
                      onClick={() => setMobileOpen(false)}
                    >
                      {item.label}
                    </Link>
                  )}
                </div>
              ))}
            </nav>

            {/* CTA Área Profesional */}
            <div className="px-5 py-5 border-t border-neutral-100 shrink-0">
              <Link
                href="/profesionales"
                className="flex items-center justify-center w-full py-3 text-xs tracking-widest uppercase border border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Área Profesional
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}
