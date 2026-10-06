"use client";

import { useState, useTransition } from "react";
import { suscribirseNewsletter } from "@/actions/newsletter";

export function FormularioNewsletter() {
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="mt-6">
      <h4 className="text-xs tracking-widest uppercase text-neutral-900 mb-2">
        Novedades y ofertas
      </h4>
      {mensaje ? (
        <p
          className={`text-xs leading-relaxed ${
            mensaje.ok ? "text-neutral-500" : "text-red-600"
          }`}
        >
          {mensaje.texto}
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const r = await suscribirseNewsletter(fd);
              setMensaje({ ok: r.ok, texto: r.mensaje });
            });
          }}
          className="flex"
        >
          <input
            type="email"
            name="email"
            required
            placeholder="tu@email.com"
            className="flex-1 min-w-0 border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
          />
          <button
            type="submit"
            disabled={pendiente}
            className="bg-neutral-900 text-white px-4 py-2 text-xs tracking-wider uppercase hover:bg-neutral-700 transition-colors disabled:opacity-50"
          >
            {pendiente ? "…" : "Unirme"}
          </button>
        </form>
      )}
      <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed">
        Confirmación por email (doble opt-in). Baja en 1 clic.{" "}
        <a href="/privacidad" className="underline">
          Privacidad
        </a>
      </p>
    </div>
  );
}
