"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { recuperarPassword } from "@/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 px-6 bg-neutral-900 text-white text-xs tracking-widest uppercase font-medium hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Enviando..." : "Enviar instrucciones"}
    </button>
  );
}

export default function RecuperarPage() {
  const [state, action] = useFormState(recuperarPassword, null);

  if (state?.success) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="bg-white border border-neutral-100 p-10">
          {/* Icono check */}
          <div className="w-12 h-12 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-6">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2
            className="text-2xl font-light text-neutral-900 mb-3"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            Revisa tu email
          </h2>
          <p className="text-sm text-neutral-500 mb-8">
            Si existe una cuenta con ese email, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
          </p>
          <Link
            href="/login"
            className="text-sm text-neutral-900 underline underline-offset-2 hover:no-underline"
          >
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1
          className="text-3xl font-light text-neutral-900 mb-2"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Recupera tu contraseña
        </h1>
        <p className="text-sm text-neutral-500">
          Introduce tu email y te enviaremos un enlace para restablecerla
        </p>
      </div>

      <form action={action} className="space-y-4 bg-white border border-neutral-100 p-8">
        {state?.error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
            {state.error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="tu@email.com"
            className="w-full border border-neutral-200 px-4 py-3 text-sm placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors"
          />
        </div>

        <SubmitButton />
      </form>

      <p className="text-center text-sm text-neutral-500 mt-6">
        <Link href="/login" className="text-neutral-900 underline underline-offset-2 hover:no-underline">
          ← Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
