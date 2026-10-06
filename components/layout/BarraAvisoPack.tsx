"use client";

import { useEffect, useState } from "react";

// Campaña Pack Cebolla: se oculta sola tras el 13/10/2026
const LIMITE = new Date("2026-10-14T00:00:00+02:00").getTime();

export function BarraAvisoPack() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Date.now() < LIMITE) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <a
      href="/packs/pack-cebolla-anticaida"
      className="block bg-[#3D2018] text-white text-center text-xs tracking-widest uppercase py-2.5 px-4 hover:bg-[#54352a] transition-colors"
    >
      Pack Cebolla Valquer · Champú 1000 ml + Mascarilla 300 ml · 19,90 € (antes 22 €) —
      solo hasta el 13 de octubre
    </a>
  );
}
