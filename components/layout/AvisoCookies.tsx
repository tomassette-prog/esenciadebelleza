"use client";

import { useEffect, useState } from "react";
import { CONSENT_KEY, MetaPixel } from "./MetaPixel";

export function AvisoCookies() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(!localStorage.getItem(CONSENT_KEY));
    } catch {
      setVisible(true);
    }
  }, []);

  function decidir(valor: "accepted" | "rejected") {
    try {
      localStorage.setItem(CONSENT_KEY, valor);
    } catch {
      // almacenamiento no disponible
    }
    setVisible(false);
    if (valor === "accepted") window.location.reload();
  }

  return (
    <>
      <MetaPixel />
      {visible && (
        <div className="fixed bottom-0 inset-x-0 z-[90] bg-white border-t border-neutral-200 px-4 py-4 sm:px-8 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="container-main flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-xs text-neutral-500 leading-relaxed max-w-2xl">
              Usamos cookies propias y de terceros para medir el rendimiento de la
              web y de nuestras campañas. Puedes aceptarlas o rechazarlas: hasta
              que no aceptes, no hay seguimiento.
            </p>
            <div className="flex gap-3 shrink-0">
              <button
                onClick={() => decidir("rejected")}
                className="text-xs tracking-widest uppercase border border-neutral-300 px-5 py-2.5 hover:border-neutral-900 transition-colors"
              >
                Rechazar
              </button>
              <button
                onClick={() => decidir("accepted")}
                className="text-xs tracking-widest uppercase bg-[#3D2018] text-white px-5 py-2.5 hover:bg-[#54352a] transition-colors"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
