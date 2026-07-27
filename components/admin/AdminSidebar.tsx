"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { href: "/admin/productos", label: "Productos", icon: "📦" },
      { href: "/admin/productos-nuevos", label: "Productos Nuevos", icon: "✨" },
    ],
  },
  {
    label: "Tienda",
    items: [
      { href: "/admin/carruseles", label: "Carruseles", icon: "🎠" },
      { href: "/admin/stock", label: "Stock", icon: "📊" },
      { href: "/admin/packs", label: "Packs", icon: "🎁" },
      { href: "/admin/envios", label: "Envíos", icon: "🚚" },
    ],
  },
  {
    label: "Contenido",
    items: [
      { href: "/admin/blog", label: "Blog", icon: "📝" },
      { href: "/admin/pedidos", label: "Pedidos", icon: "🛒" },
      { href: "/admin/profesionales", label: "Profesionales", icon: "👩‍🎨" },
      { href: "/admin/resenas", label: "Reseñas", icon: "⭐" },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { href: "/admin/catalogo", label: "Categorías y Marcas", icon: "🏷️" },
    ],
  },
  {
    label: "Sincronización",
    items: [
      { href: "/admin/sincronizacion", label: "Importar", icon: "🔄" },
      { href: "/admin/sincronizacion?tab=merchant", label: "Merchant Center", icon: "🛒" },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    const base = href.split("?")[0];
    return pathname === base || pathname.startsWith(base + "/");
  }

  return (
    <aside className="w-56 bg-neutral-900 text-white min-h-screen flex flex-col shrink-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-neutral-800">
        <Link href="/" className="text-xs tracking-widest uppercase text-neutral-400 hover:text-white transition-colors">
          ← Tienda
        </Link>
        <div className="text-xs tracking-widest uppercase mt-2" style={{ color: "var(--color-oro, #C4857A)" }}>
          Admin
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className="mb-1">
            {section.label && (
              <div className="px-4 pt-3 pb-1 text-[10px] tracking-widest uppercase text-neutral-500 font-medium">
                {section.label}
              </div>
            )}
            {section.items.map(item => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-4 py-2 text-xs transition-colors ${
                    active
                      ? "bg-white/10 text-white font-medium"
                      : "text-neutral-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="text-sm">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
