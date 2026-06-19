"use client";

import { useTransition } from "react";
import { aprobarProfesional, rechazarProfesional } from "@/actions/profesionales";

interface Props {
  userId: string;
  b2bAprobado: boolean;
}

export default function ProfesionalAcciones({ userId, b2bAprobado }: Props) {
  const [pending, startTransition] = useTransition();

  function handleAprobar() {
    startTransition(async () => {
      const res = await aprobarProfesional(userId);
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

  return (
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
  );
}
