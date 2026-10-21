"use client";

import { useState, useTransition } from "react";
import { suscribirAvisoReposicion } from "@/actions/conversion";

// Signup for restock alerts on out-of-stock products. The supplier owns the
// stock; we notify the customer when our DB sees units again.

export function AvisoReposicionBtn({
  productoId,
  variacionId,
}: {
  productoId: string;
  variacionId?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"form" | "hecho" | "error">("form");
  const [mensaje, setMensaje] = useState("");
  const [pendiente, startTransition] = useTransition();

  const enviar = () => {
    startTransition(async () => {
      const res = await suscribirAvisoReposicion(productoId, variacionId ?? null, email);
      if (res.ok) {
        setEstado("hecho");
      } else {
        setEstado("error");
        setMensaje(res.error ?? "No se pudo guardar el aviso.");
      }
    });
  };

  if (estado === "hecho") {
    return (
      <p className="mt-3 text-sm text-neutral-600">
        ✅ Te avisaremos por email cuando vuelva a estar disponible.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
        Avísame cuando vuelva
      </label>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          className="flex-1 border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
        />
        <button
          type="button"
          onClick={enviar}
          disabled={pendiente || !email.trim()}
          className="px-5 py-3 bg-white border border-neutral-900 text-neutral-900 text-xs tracking-widest uppercase hover:bg-neutral-900 hover:text-white disabled:opacity-50 transition-colors"
        >
          {pendiente ? "..." : "Avisarme"}
        </button>
      </div>
      {estado === "error" && <p className="mt-1.5 text-xs text-red-600">{mensaje}</p>}
    </div>
  );
}
