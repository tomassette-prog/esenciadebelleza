"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string; redirect?: string; error?: string };
}) {
  const [verPassword, setVerPassword] = useState(false);

  return (
    <div className="w-full max-w-md">
      {/* Título */}
      <div className="text-center mb-8">
        <h1
          className="text-3xl font-light text-neutral-900 mb-2"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Bienvenida de nuevo
        </h1>
        <p className="text-sm text-neutral-500">
          Accede a tu cuenta para ver tus pedidos y datos
        </p>
      </div>

      {/* Alerta de error de callback */}
      {searchParams.error === "auth" && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
          El enlace ha expirado o no es válido. Inténtalo de nuevo.
        </div>
      )}

      {/* Formulario */}
      <form action="/api/auth/login" method="POST" className="space-y-4 bg-white border border-neutral-100 p-8">
        {/* Error del servidor */}
        {searchParams?.error === "credenciales" && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
            Credenciales incorrectas. Verifica tu email y contraseña.
          </div>
        )}

        {/* Redirect oculto */}
        <input type="hidden" name="redirectTo" value={searchParams.redirectTo ?? searchParams.redirect ?? ""} />

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
            className="w-full border border-neutral-200 px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors"
          />
        </div>

        {/* Contraseña */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-xs tracking-wider uppercase text-neutral-600">
              Contraseña
            </label>
            <Link
              href="/recuperar"
              className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
            >
              ¿La olvidaste?
            </Link>
          </div>
          <div className="relative">
            <input
            id="password"
            name="password"
            type={verPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="w-full border border-neutral-200 px-4 py-3 pr-12 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors"
          />
          <button
            type="button"
            onClick={() => setVerPassword(!verPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 transition-colors"
            tabIndex={-1}
            aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {verPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3 px-6 bg-neutral-900 text-white text-xs tracking-widest uppercase font-medium hover:bg-neutral-700 transition-colors"
        >
          Iniciar sesión
        </button>
      </form>

      {/* Registro */}
      <p className="text-center text-sm text-neutral-500 mt-6">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/registro" className="text-neutral-900 underline underline-offset-2 hover:no-underline">
          Regístrate
        </Link>
      </p>
    </div>
  );
}
