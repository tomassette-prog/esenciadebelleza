"use client";

import { useRef, useState, useTransition } from "react";
import { crearResena } from "@/actions/resenas";

interface Props {
  productoId: string;
  user: { id: string; email?: string } | null;
}

const ESTRELLAS = [1, 2, 3, 4, 5] as const;

export function FormularioResena({ productoId, user }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [valoracion, setValoracion] = useState(0);
  const [hover, setHover] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!user) {
    return (
      <p className="text-sm text-neutral-500 italic">
        <a href="/login" className="text-amber-700 hover:underline">Inicia sesión</a>{" "}
        para dejar una reseña.
      </p>
    );
  }

  if (enviado) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        ¡Gracias por tu reseña! Estará visible tras ser aprobada.
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (valoracion === 0) {
      setError("Selecciona una valoración.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.set("valoracion", String(valoracion));
    fd.set("producto_id", productoId);
    setError(null);
    startTransition(async () => {
      const res = await crearResena(fd);
      if (res?.error) {
        setError(res.error);
      } else {
        setEnviado(true);
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {/* Estrellas */}
      <div>
        <label className="block text-xs font-medium text-neutral-700 mb-1">
          Valoración *
        </label>
        <div className="flex gap-1">
          {ESTRELLAS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setValoracion(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              className="text-2xl leading-none transition-colors"
              aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
            >
              <span className={(hover || valoracion) >= n ? "text-amber-400" : "text-neutral-300"}>
                ★
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Nombre */}
      <div>
        <label className="block text-xs font-medium text-neutral-700 mb-1">
          Tu nombre *
        </label>
        <input
          name="autor_nombre"
          required
          maxLength={80}
          placeholder="Nombre público"
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
      </div>

      {/* Título */}
      <div>
        <label className="block text-xs font-medium text-neutral-700 mb-1">
          Título (opcional)
        </label>
        <input
          name="titulo"
          maxLength={120}
          placeholder="Resumen de tu experiencia"
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
      </div>

      {/* Cuerpo */}
      <div>
        <label className="block text-xs font-medium text-neutral-700 mb-1">
          Reseña *
        </label>
        <textarea
          name="cuerpo"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          placeholder="Cuéntanos tu experiencia con el producto..."
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
        />
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-neutral-900 px-6 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? "Enviando..." : "Enviar reseña"}
      </button>

      <p className="text-xs text-neutral-400">
        Las reseñas son revisadas antes de publicarse.
      </p>
    </form>
  );
}
