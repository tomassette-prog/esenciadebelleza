import Link from "next/link";

export default function ProductoNotFound() {
  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-6">
        <p className="text-6xl font-light text-neutral-200">404</p>
        <h1
          className="text-2xl font-light text-neutral-900"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Producto descatalogado
        </h1>
        <p className="text-sm text-neutral-500">
          Este producto ya no está disponible en nuestra tienda.
          Puede que lo hayamos sustituido por una versión más reciente.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/"
            className="px-6 py-2.5 bg-[#3D2018] text-white text-xs tracking-widest uppercase hover:bg-neutral-900 transition-colors"
          >
            Volver al inicio
          </Link>
          <Link
            href="/productos"
            className="px-6 py-2.5 border border-neutral-300 text-neutral-700 text-xs tracking-widest uppercase hover:border-neutral-500 transition-colors"
          >
            Ver catálogo
          </Link>
        </div>
      </div>
    </main>
  );
}
