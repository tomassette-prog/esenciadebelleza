import { getResenasPendientes } from "@/actions/resenas";
import { ModerarResenaBtn } from "@/components/admin/ModerarResenaBtn";

export const dynamic = "force-dynamic";

export default async function AdminResenasPage() {
  const resenas = await getResenasPendientes();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reseñas pendientes ({resenas.length})</h1>

      {resenas.length === 0 ? (
        <p className="text-sm text-neutral-500">No hay reseñas pendientes de moderación.</p>
      ) : (
        <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {resenas.map((r) => {
            const rr = r as typeof r & { productos_padre?: { nombre: string; slug: string } | null };
            return (
              <div key={r.id} className="p-5 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-neutral-400">
                      Producto:{" "}
                      <span className="font-medium text-neutral-700">
                        {rr.productos_padre?.nombre ?? r.producto_id}
                      </span>
                      {" · "}
                      {new Date(r.created_at).toLocaleString("es-ES")}
                    </p>
                    <p className="text-sm font-medium text-neutral-900">
                      {"★".repeat(r.valoracion)}{"☆".repeat(5 - r.valoracion)}{" "}
                      {r.autor_nombre}
                    </p>
                    {r.titulo && (
                      <p className="text-sm font-medium">{r.titulo}</p>
                    )}
                    <p className="text-sm text-neutral-600 leading-relaxed">{r.cuerpo}</p>
                  </div>
                  <div className="shrink-0">
                    <ModerarResenaBtn resena={r} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
