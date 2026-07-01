"use client";

import { useState, useTransition } from "react";
import { generarSeoBulk } from "@/actions/productos";

export function GenerarSeoBulkBtn({ categoria }: { categoria?: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function handleClick() {
    setResult(null);
    setErr(null);
    startTransition(async () => {
      const res = await generarSeoBulk({ soloSinSeo: true, categoria });
      if (res.error) setErr(res.error);
      else setResult({ ok: res.ok });
    });
  }

  if (result) {
    return (
      <span className="text-xs text-green-700 border border-green-200 bg-green-50 px-3 py-1.5">
        ✓ SEO generado: {result.ok} productos
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {err && <span className="text-xs text-red-500">{err}</span>}
      <button
        onClick={handleClick}
        disabled={isPending}
        className="px-4 py-1.5 border border-neutral-300 text-xs text-neutral-600 hover:border-neutral-600 hover:text-neutral-900 disabled:opacity-40 transition-colors"
      >
        {isPending ? "Generando SEO…" : "Generar SEO (sin texto)"}
      </button>
    </div>
  );
}
