"use client";

import { useFormState, useFormStatus } from "react-dom";
import { nuevaPassword } from "@/actions/auth";
import { PasswordField } from "@/components/layout/CambiarPasswordForm";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full px-6 py-2.5 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 disabled:opacity-50 transition-colors"
    >
      {pending ? "Guardando..." : "Guardar contraseña"}
    </button>
  );
}

export default function NuevaPasswordPage() {
  const [state, action] = useFormState(nuevaPassword, null);

  return (
    <div>
      <h2
        className="text-2xl font-light text-neutral-900 mb-2"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        Elige tu nueva contraseña
      </h2>
      <p className="text-sm text-neutral-400 mb-6">
        A partir de ahora accederás a tu cuenta con esta contraseña.
      </p>

      <div className="bg-white border border-neutral-100 p-6">
        <h3 className="text-xs tracking-widest uppercase text-neutral-500 mb-5">
          Nueva contraseña
        </h3>

        <form action={action} className="space-y-4 max-w-sm">
          {state?.error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
              {state.error}
            </div>
          )}

          <PasswordField id="password" label="Nueva contraseña" minLength={8} />
          <p className="text-xs text-neutral-400 -mt-2">Mínimo 8 caracteres</p>

          <PasswordField id="confirmar" label="Confirmar contraseña" minLength={8} />

          <SubmitButton />
        </form>
      </div>
    </div>
  );
}
