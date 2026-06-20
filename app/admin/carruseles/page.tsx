import type { Metadata } from "next";
import { buscarProductosCarrusel } from "@/actions/productos";
import { CarruselesClient } from "./CarruselesClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Carruseles | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminCarruselesPage() {
  // Cargamos los productos ya en carruseles al entrar
  const productosDestacados = await buscarProductosCarrusel("");

  return (
    <div className="container-main py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
          Gestión de carruseles
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Busca productos y activa en qué carrusel de la home quieres mostrarlos.
        </p>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 mb-8 p-4 bg-neutral-50 border border-neutral-100 text-xs text-neutral-600">
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-400" />
          <strong>Oferta</strong> — aparece en el carrusel &ldquo;Ofertas destacadas&rdquo;
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" />
          <strong>Novedad</strong> — aparece en el carrusel &ldquo;Novedades&rdquo;
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm bg-sky-500" />
          <strong>Destacado</strong> — aparece si no hay ofertas activas
        </span>
      </div>

      <CarruselesClient productosIniciales={productosDestacados} />
    </div>
  );
}
