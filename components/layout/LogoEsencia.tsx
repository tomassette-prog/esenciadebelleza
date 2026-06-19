"use client";

/**
 * Logo de Esencia de Belleza
 * Replica la opción izquierda de la imagen de referencia:
 * - "esencia" + "belleza.es" en serif fino, rosa empolvado
 * - "de" en cursiva ligeramente más oscuro
 * - Icono frasco de perfume + flor a la derecha
 * - Descriptor "Peluquería • Estética • Perfumes" debajo
 */
export function LogoEsencia({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex flex-col items-start leading-none ${className}`}>
      {/* Línea principal */}
      <span className="flex items-end gap-0" style={{ lineHeight: 1 }}>
        <span
          style={{
            fontFamily: "var(--font-cormorant), 'Cormorant Garamond', 'Palatino Linotype', Georgia, serif",
            fontSize: "clamp(22px, 3.5vw, 32px)",
            fontWeight: 400,
            fontStyle: "normal",
            color: "#C4857A",
            letterSpacing: "0.01em",
          }}
        >
          esencia
        </span>
        <span
          style={{
            fontFamily: "var(--font-cormorant), 'Cormorant Garamond', 'Palatino Linotype', Georgia, serif",
            fontSize: "clamp(22px, 3.5vw, 32px)",
            fontWeight: 600,
            fontStyle: "italic",
            color: "#9A5A50",
            letterSpacing: "0.01em",
          }}
        >
          de
        </span>
        <span
          style={{
            fontFamily: "var(--font-cormorant), 'Cormorant Garamond', 'Palatino Linotype', Georgia, serif",
            fontSize: "clamp(22px, 3.5vw, 32px)",
            fontWeight: 400,
            fontStyle: "normal",
            color: "#C4857A",
            letterSpacing: "0.01em",
          }}
        >
          belleza.es
        </span>

        {/* Icono frasco de perfume + flor */}
        <svg
          viewBox="0 0 36 60"
          width="22"
          height="36"
          fill="none"
          stroke="#C4857A"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginLeft: "5px", marginBottom: "2px", flexShrink: 0 }}
          aria-hidden="true"
        >
          {/* Pétalos flor */}
          <path d="M18 18 C16 10,11 8,10 3 C11 9,15 12,18 14" strokeWidth="1.4" fill="#C4857A" fillOpacity="0.2"/>
          <path d="M18 18 C18 9,18 6,18 2 C18 6,18 9,18 14" strokeWidth="1.4" fill="#C4857A" fillOpacity="0.2"/>
          <path d="M18 18 C20 10,25 8,26 3 C25 9,21 12,18 14" strokeWidth="1.4" fill="#C4857A" fillOpacity="0.2"/>
          <path d="M18 20 C13 14,6 14,3 10 C7 14,13 16,18 18" strokeWidth="1.2" fill="#C4857A" fillOpacity="0.15"/>
          <path d="M18 20 C23 14,30 14,33 10 C29 14,23 16,18 18" strokeWidth="1.2" fill="#C4857A" fillOpacity="0.15"/>
          {/* Tapón */}
          <rect x="12" y="14" width="12" height="6" rx="1.5" strokeWidth="1.3" fill="white"/>
          {/* Cuello */}
          <rect x="14" y="20" width="8" height="5" rx="1" strokeWidth="1.2" fill="white"/>
          {/* Cuerpo */}
          <path d="M9 25 Q7 25,7 28 L7 50 Q7 54,11 54 L25 54 Q29 54,29 50 L29 28 Q29 25,27 25 Z"
            strokeWidth="1.3" fill="white"/>
          {/* Línea decorativa */}
          <line x1="11" y1="36" x2="25" y2="36" strokeWidth="0.9" opacity="0.5"/>
          {/* Etiqueta */}
          <ellipse cx="18" cy="44" rx="6" ry="4.5" strokeWidth="1" opacity="0.5"/>
        </svg>
      </span>

      {/* Descriptor */}
      <span
        style={{
          fontFamily: "'Raleway', 'Helvetica Neue', Arial, sans-serif",
          fontSize: "clamp(8px, 1vw, 10px)",
          fontWeight: 300,
          color: "#C4857A",
          letterSpacing: "0.22em",
          marginTop: "4px",
          opacity: 0.9,
        }}
      >
        Peluquería&nbsp;•&nbsp;Estética&nbsp;•&nbsp;Perfumes
      </span>
    </span>
  );
}
