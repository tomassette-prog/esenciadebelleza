"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { eliminarProducto } from "@/actions/productos";

export function EliminarProductoBtn({ id, nombre }: { id: string; nombre: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleEliminar() {
    if (!confirm(`¿Desactivar "${nombre}"?\n\nEl producto quedará inactivo y no aparecerá en la tienda. Podrás reactivarlo editándolo.`)) return;
    setPending(true);
    const res = await eliminarProducto(id);
    if (res.error) {
      alert("Error: " + res.error);
      setPending(false);
    } else {
      router.push("/admin/productos");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleEliminar}
      disabled={pending}
      className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
    >
      {pending ? "Eliminando..." : "Desactivar"}
    </button>
  );
}
