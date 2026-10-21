"use client";

import { useState, useTransition } from "react";
import { crearResenaConToken } from "@/actions/conversion";

// Guest review form reached from the post-purchase email (signed link).

export function FormularioResenaToken({
  token,
  email,
  productoId,
  pedidoId,
  nombreProducto,
}: {
  token: string;
  email: string;
  productoId: string;
  pedidoId: string;
  nombreProducto: string;
}) {
  const [autor, setAutor] = useState("");
  const [puntuacion, setPuntuacion] = useState(5);
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [estado, setEstado] = useState<"form" | "hecho" | "error">("form");
  const [mensaje, setMensaje] = useState("");
  const [pendiente, startTransition] = useTransition();

  const enviar = () => {
    startTransition(async () => {
      const res = await crearResenaConToken(token, {
        email, productoId, pedidoId,
        autor_nombre: autor, valoracion: puntuacion, titulo, cuerpo,
      });
      if (res.ok) setEstado("hecho");
      else {
        setEstado("error");
        setMensaje(res.error ?? "No se pudo publicar la reseña.");
      }
    });
  };

  if (estado === "hecho") {
    return (
      <div className="p-6 bg-neutral-50 border border-neutral-200 text-center">
        <p className="text-lg text-neutral-900 mb-2">¡Gracias por tu reseña! 🌸</p>
        <p className="text-sm text-neutral-600">
          La publicaremos tras una breve revisión.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        Reseña de <strong>{nombreProducto}</strong>
      </p>

      <div>
        <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">Tu nombre</label>
        <input
          value={autor}
          onChange={(e) => setAutor(e.target.value)}
          placeholder="¿Cómo te llamas?"
          className="w-full border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900"
        />
      </div>

      <div>
        <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">Puntuación</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPuntuacion(n)}
              className={`w-11 h-11 border text-lg transition-colors ${
                n <= puntuacion
                  ? "bg-[#C4857A] text-white border-[#C4857A]"
                  : "bg-white text-neutral-400 border-neutral-200"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">Título (opcional)</label>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Resume tu experiencia"
          className="w-full border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900"
        />
      </div>

      <div>
        <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">Tu opinión</label>
        <textarea
          value={cuerpo}
          onChange={(e) => setCuerpo(e.target.value)}
          rows={4}
          placeholder="¿Qué te ha parecido el producto?"
          className="w-full border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900"
        />
      </div>

      {estado === "error" && <p className="text-sm text-red-600">{mensaje}</p>}

      <button
        type="button"
        onClick={enviar}
        disabled={pendiente || !autor.trim() || cuerpo.trim().length < 5}
        className="w-full py-4 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 disabled:opacity-50 transition-colors"
      >
        {pendiente ? "Enviando..." : "Publicar mi reseña"}
      </button>
    </div>
  );
}
