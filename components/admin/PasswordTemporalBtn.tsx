"use client";

import { useTransition, useState } from "react";
import { ponerPasswordTemporal } from "@/actions/profesionales";

interface Props {
  userId: string;
  nombre: string;
}

export default function PasswordTemporalBtn({ userId, nombre }: Props) {
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mostrar, setMostrar] = useState(false);

  function handleReset() {
    if (!password || password.length < 8) {
      setError("Mínimo 8 caracteres");
      return;
    }

    setError(null);
    setResultado(null);

    startTransition(async () => {
      const res = await ponerPasswordTemporal(userId, password);
      if (res.error) {
        setError(res.error);
      } else {
        setResultado(`Contraseña actualizada para ${nombre}. Pásale esta contraseña por WhatsApp.`);
        setPassword("");
      }
    });
  }

  function generarPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let result = "";
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(result);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">
        Ponle una contraseña temporal y pásasela por WhatsApp. Ella la puede cambiar después desde su perfil.
      </p>

      <div className="flex items-center gap-2">
        <input
          type={mostrar ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          className="flex-1 border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
          disabled={pending}
        />
        <button
          type="button"
          onClick={() => setMostrar(!mostrar)}
          className="text-xs px-2 py-2 border border-neutral-200 hover:bg-neutral-100 transition-colors"
          title={mostrar ? "Ocultar" : "Mostrar"}
        >
          {mostrar ? "🙈" : "👁️"}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleReset}
          disabled={pending || password.length < 8}
          className="text-xs px-4 py-2 bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50 transition-colors"
        >
          {pending ? "Guardando..." : "Poner contraseña"}
        </button>
        <button
          type="button"
          onClick={generarPassword}
          disabled={pending}
          className="text-xs px-4 py-2 border border-neutral-200 hover:bg-neutral-100 transition-colors"
        >
          Generar aleatoria
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {resultado && (
        <div className="p-3 bg-green-50 border border-green-200">
          <p className="text-sm text-green-800">{resultado}</p>
          {password === "" && (
            <p className="text-xs text-green-600 mt-1">
              Copia la contraseña antes de cerrar esta página.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
