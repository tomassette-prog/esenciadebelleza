import type { Metadata } from "next";
import Link from "next/link";
import { getPacksAdmin } from "@/actions/packs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Packs de regalo | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPacksPage() {
  const packs = await getPacksAdmin();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
            Packs de regalo
          </h1>
          <p className="text-sm text-neutral-400 mt-1">{packs.length} pack{packs.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/admin/packs/nuevo" className="btn-primary px-6 py-2.5 text-sm tracking-widest uppercase">
          + Nuevo pack
        </Link>
      </div>

      <div className="bg-white border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="text-left px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest">Pack</th>
              <th className="text-right px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest">Precio pack</th>
              <th className="text-right px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest hidden md:table-cell">Precio sin pack</th>
              <th className="text-center px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest">Productos</th>
              <th className="text-center px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest">Stock</th>
              <th className="text-center px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {packs.map((pack) => {
              const ahorro = pack.precio_original
                ? pack.precio_original - pack.precio_pack
                : null;
              return (
                <tr key={pack.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {pack.imagen_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={pack.imagen_url} alt="" className="w-10 h-10 object-contain bg-neutral-50 border border-neutral-100 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 bg-neutral-100 border border-neutral-200 shrink-0 flex items-center justify-center text-neutral-300 text-lg">🎁</div>
                      )}
                      <div>
                        <p className="font-medium text-neutral-900">{pack.nombre}</p>
                        <p className="text-xs text-neutral-400">/packs/{pack.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[#3D2018]">
                    {pack.precio_pack.toFixed(2)} €
                    {ahorro && (
                      <div className="text-xs text-green-600 font-normal">-{ahorro.toFixed(2)} €</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-400 hidden md:table-cell">
                    {pack.precio_original ? `${pack.precio_original.toFixed(2)} €` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-neutral-600">{pack.items.length}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-medium ${pack.stock_disponible > 0 ? "text-green-700" : "text-red-500"}`}>
                      {pack.stock_disponible > 0 ? `${pack.stock_disponible} uds` : "Agotado"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 text-xs ${pack.activo ? "bg-green-50 text-green-700 border border-green-200" : "bg-neutral-100 text-neutral-500 border border-neutral-200"}`}>
                      {pack.activo ? "Activo" : "Inactivo"}
                    </span>
                    {pack.destacado && (
                      <span className="ml-1 inline-block px-1.5 py-0.5 text-[10px] bg-amber-50 text-amber-700 border border-amber-200">★</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/packs/${pack.id}`} className="text-xs text-neutral-600 hover:text-neutral-900 underline underline-offset-2">
                      Editar
                    </Link>
                  </td>
                </tr>
              );
            })}
            {packs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-sm text-neutral-400">
                  No hay packs creados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
