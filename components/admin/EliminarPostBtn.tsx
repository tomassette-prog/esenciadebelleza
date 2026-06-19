"use client";

import { useTransition } from "react";
import { eliminarPost } from "@/actions/blog";

export default function EliminarPostBtn({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        if (!confirm("¿Eliminar este post definitivamente?")) return;
        startTransition(async () => {
          const res = await eliminarPost(id);
          if (res.error) alert("Error: " + res.error);
        });
      }}
      disabled={pending}
      className="text-xs px-3 py-1.5 border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors tracking-wider uppercase"
    >
      Eliminar
    </button>
  );
}
