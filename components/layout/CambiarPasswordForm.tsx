"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
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

export function PasswordField({
  id,
  label,
  placeholder,
  minLength,
}: {
  id: string;
  label: string;
  placeholder?: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          minLength={minLength}
          required
          placeholder={placeholder}
          className="w-full border border-neutral-200 px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 transition-colors p-1"
          tabIndex={-1}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {visible ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>
    </div>
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

        <PasswordField id="actual" label="Contraseña actual" />

        <PasswordField id="nueva" label="Nueva contraseña" minLength={8} />
        <p className="text-xs text-neutral-400 -mt-2">Mínimo 8 caracteres</p>

        <PasswordField id="confirmar" label="Confirmar nueva contraseña" minLength={8} />

        <SubmitButton />
      </form>
    </div>
  );
}
