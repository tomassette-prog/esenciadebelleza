"use client";

import { useTransition, useState } from "react";
import { aprobarProfesional, rechazarProfesional, actualizarDescuentoProfesional } from "@/actions/profesionales";

interface Props {
  userId: string;
  b2bAprobado: boolean;
  descuentoB2b: number;
}

export default function ProfesionalAcciones({ userId, b2bAprobado, descuentoB2b }: Props) {
  const [pending, startTransition] = useTransition();
  const [descuento, setDescuento] = useState(descuentoB2b);

  function handleAprobar() {
    startTransition(async () => {
      const res = await aprobarProfesional(userId, descuento);
      if (res.error) alert("Error: " + res.error);
    });
  }

  function handleRechazar() {
    if (!confirm("¿Rechazar y convertir a cuenta normal B2C?")) return;
    startTransition(async () => {
      const res = await rechazarProfesional(userId);
      if (res.error) alert("Error: " + res.error);
    });
  }

  function handleGuardarDescuento() {
    startTransition(async () => {
      const res = await actualizarDescuentoProfesional(userId, descuento);
      if (res.error) alert("Error: " + res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {/* Campo de descuento */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-neutral-500">Dto. %</label>
        <input
          type="number"
          min={0}
          max={100}
          value={descuento}
          onChange={(e) => setDescuento(Number(e.target.value))}
          className="w-16 border border-neutral-200 px-2 py-1 text-xs text-center focus:outline-none focus:border-neutral-900"
          disabled={pending}
        />
        {b2bAprobado && descuento !== descuentoB2b && (
          <button
            onClick={handleGuardarDescuento}
            disabled={pending}
            className="text-xs px-2 py-1 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Guardar
          </button>
        )}
      </div>

      {/* Botones de acción */}
      <div className="flex items-center gap-2">
        {!b2bAprobado && (
          <button
            onClick={handleAprobar}
            disabled={pending}
            className="text-xs px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors tracking-wider uppercase"
          >
            Aprobar
          </button>
        )}
        {b2bAprobado && (
          <button
            onClick={handleRechazar}
            disabled={pending}
            className="text-xs px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors tracking-wider uppercase"
          >
            Revocar
          </button>
        )}
        {!b2bAprobado && (
          <button
            onClick={handleRechazar}
            disabled={pending}
            className="text-xs px-3 py-1.5 border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors tracking-wider uppercase"
          >
            Rechazar
          </button>
        )}
      </div>
    </div>
  );
}
