import type { Resena, ResenaAggregate } from "@/types/producto";

interface Props {
  resenas: Resena[];
  aggregate: ResenaAggregate | null;
}

function Estrellas({ valor, max = 5 }: { valor: number; max?: number }) {
  return (
    <span aria-label={`${valor} de ${max} estrellas`} className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < Math.round(valor) ? "text-amber-400" : "text-neutral-300"}>
          ★
        </span>
      ))}
    </span>
  );
}

export function ListaResenas({ resenas, aggregate }: Props) {
  if (!aggregate || aggregate.total_resenas === 0) {
    return (
      <p className="text-sm text-neutral-500 italic">
        Aún no hay reseñas para este producto. ¡Sé el primero!
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen aggregate */}
      <div className="flex items-center gap-4 rounded-lg border border-neutral-100 bg-neutral-50 px-5 py-4">
        <span className="text-4xl font-light text-neutral-900">
          {aggregate.valoracion_media.toFixed(1)}
        </span>
        <div>
          <Estrellas valor={aggregate.valoracion_media} />
          <p className="text-xs text-neutral-500 mt-0.5">
            {aggregate.total_resenas} reseña{aggregate.total_resenas !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Lista */}
      <ul className="divide-y divide-neutral-100">
        {resenas.map((r) => (
          <li key={r.id} className="py-5">
            <div className="flex items-center gap-2 mb-1">
              <Estrellas valor={r.valoracion} />
              <span className="text-xs text-neutral-400">
                {new Date(r.created_at).toLocaleDateString("es-ES", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            {r.titulo && (
              <p className="text-sm font-medium text-neutral-900 mb-1">{r.titulo}</p>
            )}
            <p className="text-sm text-neutral-600 leading-relaxed">{r.cuerpo}</p>
            <p className="text-xs text-neutral-400 mt-2">— {r.autor_nombre}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
