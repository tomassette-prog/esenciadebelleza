"use client";

import { useTransition } from "react";
import { moderarResena } from "@/actions/resenas";
import type { Resena } from "@/types/producto";

interface ResenaConProducto extends Resena {
  productos_padre?: { nombre: string; slug: string } | null;
}

export function ModerarResenaBtn({
  resena,
}: {
  resena: ResenaConProducto;
}) {
  const [isPending, startTransition] = useTransition();

  function handle(aprobar: boolean) {
    startTransition(() => moderarResena(resena.id, aprobar));
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handle(true)}
        disabled={isPending}
        className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
      >
        Aprobar
      </button>
      <button
        onClick={() => handle(false)}
        disabled={isPending}
        className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
      >
        Rechazar
      </button>
    </div>
  );
}
