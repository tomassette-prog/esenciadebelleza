import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { type ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    redirect("/login?redirectTo=/admin/productos");
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Barra de navegación admin */}
      <nav className="bg-neutral-900 text-white">
        <div className="container-main flex items-center gap-8 h-12">
          <Link
            href="/"
            className="text-xs tracking-widest uppercase text-neutral-400 hover:text-white transition-colors"
          >
            ← Tienda
          </Link>
          <div className="w-px h-4 bg-neutral-700" />
          <span className="text-xs tracking-widest uppercase" style={{ color: "var(--color-oro)" }}>
            Admin
          </span>
          <div className="flex items-center gap-6 ml-2">
            <Link
              href="/admin/productos"
              className="text-xs tracking-widest uppercase text-neutral-300 hover:text-white transition-colors"
            >
              Productos
            </Link>
            <Link
              href="/admin/stock"
              className="text-xs tracking-widest uppercase text-neutral-300 hover:text-white transition-colors"
            >
              Stock
            </Link>
          </div>
        </div>
      </nav>

      {/* Contenido */}
      <div className="container-main py-8">
        {children}
      </div>
    </div>
  );
}
