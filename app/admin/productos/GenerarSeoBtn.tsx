"use client";

import { useState, useTransition } from "react";
import { generarSeoProducto } from "@/actions/productos";

export function GenerarSeoBtn({ productoId }: { productoId: string }) {
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
      title="Generar SEO"
      className="text-xs text-neutral-400 hover:text-neutral-700 disabled:opacity-40 transition-colors"
    >
      {isPending ? "…" : "SEO"}
    </button>
  );
}
