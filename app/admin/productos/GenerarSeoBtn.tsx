"use client";

import { useState, useTransition } from "react";
import { generarSeoProducto } from "@/actions/productos";

export function GenerarSeoBtn({ productoId, hasSeo = false }: { productoId: string; hasSeo?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(false);

  function handleClick() {
    setDone(false);
    setErr(false);
    startTransition(async () => {
      const res = await generarSeoProducto(productoId);
      if (res.ok) setDone(true);
      else setErr(true);
    });
  }

  if (done) return <span className="text-xs text-green-600" title="SEO generado">✓ SEO</span>;
  if (err)  return <span className="text-xs text-red-500" title="Error al generar SEO">✗ SEO</span>;

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      title={hasSeo ? "SEO ya generado — regenerar" : "Generar SEO"}
      className={`text-xs disabled:opacity-40 transition-colors ${hasSeo ? "text-green-500 hover:text-green-700" : "text-neutral-400 hover:text-neutral-700"}`}
    >
      {isPending ? "…" : hasSeo ? "✓SEO" : "SEO"}
    </button>
  );
}
