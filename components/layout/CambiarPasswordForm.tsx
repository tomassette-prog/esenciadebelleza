"use client";

import { useFormState, useFormStatus } from "react-dom";
import { cambiarPassword } from "@/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-6 py-2.5 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 disabled:opacity-50 transition-colors"
    >
      {pending ? "Guardando..." : "Guardar nueva contraseña"}
    </button>
  );
}

export default function CambiarPasswordForm() {
  const [state, action] = useFormState(cambiarPassword, null);

  if (state?.success) {
    return (
      <div className="bg-white border border-neutral-100 p-6">
        <h3 className="text-xs tracking-widest uppercase text-neutral-500 mb-4">
          Seguridad
        </h3>
        <div className="p-4 bg-green-50 border border-green-200 text-green-800 text-sm">
          ✓ Contraseña actualizada correctamente.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-neutral-100 p-6">
      <h3 className="text-xs tracking-widest uppercase text-neutral-500 mb-4">
        Seguridad
      </h3>

      <form action={action} className="space-y-4 max-w-sm">
        {state?.error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
            {state.error}
          </div>
        )}

        <div>
          <label htmlFor="nueva" className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
            Nueva contraseña
          </label>
          <input
            id="nueva"
            name="nueva"
            type="password"
            minLength={8}
            required
            className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
          />
          <p className="text-xs text-neutral-400 mt-1">Mínimo 8 caracteres</p>
        </div>

        <div>
          <label htmlFor="confirmar" className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
            Confirmar nueva contraseña
          </label>
          <input
            id="confirmar"
            name="confirmar"
            type="password"
            minLength={8}
            required
            className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
          />
        </div>

        <SubmitButton />
      </form>
    </div>
  );
}
