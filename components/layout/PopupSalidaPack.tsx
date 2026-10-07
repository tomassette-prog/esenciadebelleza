"use client";

import { useEffect, useState } from "react";

// Popup de salida campaña Pack Cebolla: se desactiva tras el 13/10/2026
const LIMITE = new Date("2026-10-14T00:00:00+02:00").getTime();
const CLAVE_LS = "popup-pack-cebolla-v1";

export function PopupSalidaPack() {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (Date.now() >= LIMITE) return;
    try {
      const ultima = Number(localStorage.getItem(CLAVE_LS) ?? 0);
      if (Date.now() - ultima < 24 * 60 * 60 * 1000) return;
    } catch {
      // almacenamiento no disponible
    }

    function abrir() {
      // No interrumpir donde el popup estorba: checkout/cuenta y la propia ficha
      // del pack (su CTA lleva a esa misma página)
      const ruta = window.location.pathname;
      if (
        ruta.startsWith("/checkout") ||
        ruta.startsWith("/cuenta") ||
        ruta.startsWith("/login") ||
        ruta === "/packs/pack-cebolla-anticaida"
      ) return;
      setAbierto(true);
      try {
        localStorage.setItem(CLAVE_LS, String(Date.now()));
      } catch {
        // ignorar
      }
    }

    function onSalida(e: MouseEvent) {
      if (e.clientY <= 0) abrir();
    }

    document.addEventListener("mouseout", onSalida);
    const temporizador = window.setTimeout(abrir, 45000);

    return () => {
      document.removeEventListener("mouseout", onSalida);
      window.clearTimeout(temporizador);
    };
  }, []);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onClick={() => setAbierto(false)}
    >
      <div
        className="bg-white max-w-md w-full p-10 text-center relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setAbierto(false)}
          aria-label="Cerrar"
          className="absolute top-3 right-4 text-neutral-400 hover:text-neutral-900 text-xl leading-none"
        >
          ×
        </button>
        <p className="text-[10px] tracking-[3px] uppercase text-[#C4857A] mb-3">
          Solo hasta el 13 de octubre
        </p>
        <h2
          className="text-2xl font-light text-neutral-900 mb-3"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Pack Cebolla Valquer
        </h2>
        <p className="text-sm text-neutral-500 leading-relaxed mb-6">
          Champú anticaída de cebolla 1000 ml + mascarilla nutritiva 300 ml.
          <br />
          <span className="line-through text-neutral-400">22,00 €</span>{" "}
          <span className="text-neutral-900 text-lg">19,90 €</span>
        </p>
        <a
          href="/packs/pack-cebolla-anticaida"
          className="inline-block bg-[#3D2018] text-white px-8 py-3 text-xs tracking-widest uppercase hover:bg-[#54352a] transition-colors"
          onClick={() => setAbierto(false)}
        >
          Ver el pack
        </a>
        <p className="text-[10px] text-neutral-400 mt-4">Envío gratis desde 40 €</p>
      </div>
    </div>
  );
}
