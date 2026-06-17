"use client";

import { useActionState } from "react";

interface Props {
  config: Record<string, string>;
  action: (
    prev: { ok: boolean; error?: string } | null,
    formData: FormData
  ) => Promise<{ ok: boolean; error?: string }>;
}

export function AdminConfigForm({ config, action }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-8">
      {/* Envíos */}
      <section className="bg-white border border-neutral-200 p-6 space-y-5">
        <h2 className="text-sm font-medium text-neutral-700 uppercase tracking-widest">
          Envíos
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">
              Envío gratis desde (€)
            </label>
            <input
              type="number"
              name="envio_gratis_desde"
              defaultValue={config.envio_gratis_desde ?? "49"}
              step="0.01"
              min="0"
              required
              className="input-clean w-full text-sm"
            />
            <p className="text-xs text-neutral-400 mt-1">
              Pedidos iguales o superiores a este importe tendrán envío gratuito.
            </p>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">
              Coste de envío estándar (€)
            </label>
            <input
              type="number"
              name="envio_coste"
              defaultValue={config.envio_coste ?? "4.95"}
              step="0.01"
              min="0"
              required
              className="input-clean w-full text-sm"
            />
            <p className="text-xs text-neutral-400 mt-1">
              Coste aplicado cuando el pedido no alcanza el mínimo para envío gratuito.
            </p>
          </div>
        </div>
      </section>

      {/* Multiplicadores de precio */}
      <section className="bg-white border border-neutral-200 p-6 space-y-5">
        <h2 className="text-sm font-medium text-neutral-700 uppercase tracking-widest">
          Multiplicadores de precio
        </h2>
        <p className="text-xs text-neutral-400">
          Valor <strong>1.0</strong> = sin ajuste. Por ejemplo, <strong>1.1</strong> sube los precios un 10% respecto a WooCommerce.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">
              Precio público (B2C) ×
            </label>
            <input
              type="number"
              name="precio_multiplicador_b2c"
              defaultValue={config.precio_multiplicador_b2c ?? "1.0"}
              step="0.01"
              min="0.01"
              required
              className="input-clean w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">
              Precio profesional (B2B) ×
            </label>
            <input
              type="number"
              name="precio_multiplicador_b2b"
              defaultValue={config.precio_multiplicador_b2b ?? "1.0"}
              step="0.01"
              min="0.01"
              required
              className="input-clean w-full text-sm"
            />
          </div>
        </div>
      </section>

      {/* Botón guardar */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary px-8 py-3 text-sm tracking-widest uppercase disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Guardar cambios"}
        </button>

        {state?.ok && (
          <p className="text-sm text-green-600">✓ Cambios guardados correctamente</p>
        )}
        {state?.error && (
          <p className="text-sm text-red-500">{state.error}</p>
        )}
      </div>
    </form>
  );
}
