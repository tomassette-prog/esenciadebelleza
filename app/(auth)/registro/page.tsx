"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { registro } from "@/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 px-6 bg-neutral-900 text-white text-xs tracking-widest uppercase font-medium hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Creando cuenta..." : "Crear cuenta"}
    </button>
  );
}

export default function RegistroPage() {
  const [state, action] = useFormState(registro, null);
  const [tipo, setTipo] = useState<"b2c" | "b2b">("b2c");

  return (
    <div className="w-full max-w-lg">
      {/* Título */}
      <div className="text-center mb-8">
        <h1
          className="text-3xl font-light text-neutral-900 mb-2"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Crea tu cuenta
        </h1>
        <p className="text-sm text-neutral-500">
          Compra como particular o como profesional con precios especiales
        </p>
      </div>

      <form action={action} className="space-y-4 bg-white border border-neutral-100 p-8">
        {/* Error */}
        {state?.error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
            {state.error}
          </div>
        )}

        {/* Tipo de cliente */}
        <div>
          <p className="text-xs tracking-wider uppercase text-neutral-600 mb-2">Tipo de cuenta</p>
          <div className="grid grid-cols-2 gap-3">
            {(["b2c", "b2b"] as const).map((t) => (
              <label
                key={t}
                className={`flex flex-col items-center justify-center p-4 border cursor-pointer transition-colors ${
                  tipo === t
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 hover:border-neutral-400"
                }`}
              >
                <input
                  type="radio"
                  name="tipo_cliente"
                  value={t}
                  checked={tipo === t}
                  onChange={() => setTipo(t)}
                  className="sr-only"
                />
                <span className="text-sm font-medium">
                  {t === "b2c" ? "Particular" : "Profesional"}
                </span>
                <span className={`text-xs mt-1 ${tipo === t ? "text-neutral-300" : "text-neutral-400"}`}>
                  {t === "b2c" ? "Uso personal" : "Salón / Clínica / Spa"}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Nombre completo */}
        <div>
          <label htmlFor="nombre_completo" className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
            Nombre completo
          </label>
          <input
            id="nombre_completo"
            name="nombre_completo"
            type="text"
            autoComplete="name"
            required
            placeholder="Tu nombre y apellidos"
            className="w-full border border-neutral-200 px-4 py-3 text-sm placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors"
          />
        </div>

        {/* Email */}
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

        {/* Teléfono */}
        <div>
          <label htmlFor="telefono" className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
            Teléfono <span className="text-neutral-400 normal-case">(opcional)</span>
          </label>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            autoComplete="tel"
            placeholder="+34 600 000 000"
            className="w-full border border-neutral-200 px-4 py-3 text-sm placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors"
          />
        </div>

        {/* Campos B2B */}
        {tipo === "b2b" && (
          <>
            <div>
              <label htmlFor="empresa" className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                Nombre del negocio / empresa <span className="text-red-500">*</span>
              </label>
              <input
                id="empresa"
                name="empresa"
                type="text"
                required={tipo === "b2b"}
                placeholder="Salón Bellezia SL"
                className="w-full border border-neutral-200 px-4 py-3 text-sm placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="nif_cif" className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                NIF / CIF <span className="text-neutral-400 normal-case">(opcional)</span>
              </label>
              <input
                id="nif_cif"
                name="nif_cif"
                type="text"
                placeholder="B12345678"
                className="w-full border border-neutral-200 px-4 py-3 text-sm placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              Los precios profesionales se activarán tras verificación del negocio (en 24-48 h).
            </div>
          </>
        )}

        {/* Contraseña */}
        <div>
          <label htmlFor="password" className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
            Contraseña <span className="text-neutral-400 normal-case">(mín. 8 caracteres)</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="••••••••"
            className="w-full border border-neutral-200 px-4 py-3 text-sm placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors"
          />
        </div>

        <SubmitButton />

        <p className="text-xs text-neutral-400 text-center">
          Al registrarte aceptas nuestra{" "}
          <Link href="/privacidad" className="underline hover:no-underline">política de privacidad</Link>
        </p>
      </form>

      <p className="text-center text-sm text-neutral-500 mt-6">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-neutral-900 underline underline-offset-2 hover:no-underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
