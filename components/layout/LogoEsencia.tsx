"use client";

export function LogoEsencia({ className = "" }: { className?: string }) {
  const color = "#C4857A";
  const colorDe = "#8B4A3F";
  const font = "var(--font-cormorant), 'Cormorant Garamond', Georgia, serif";
  const size = "clamp(20px, 3vw, 30px)";

  return (
    <span className={`inline-flex flex-col items-start leading-none select-none ${className}`}>
      {/* Fila principal: texto + icono */}
      <span className="flex items-center" style={{ gap: "6px" }}>
        {/* Texto */}
        <span style={{ display: "flex", alignItems: "baseline", lineHeight: 1 }}>
          <span style={{ fontFamily: font, fontSize: size, fontWeight: 300, color, letterSpacing: "0.02em" }}>
            esencia
          </span>
          <span style={{ fontFamily: font, fontSize: size, fontWeight: 700, fontStyle: "italic", color: colorDe, letterSpacing: "0.01em" }}>
            de
          </span>
          <span style={{ fontFamily: font, fontSize: size, fontWeight: 300, color, letterSpacing: "0.02em" }}>
            belleza.es
          </span>
        </span>

        {/* Icono: frasco perfume + flor de loto */}
        <svg
          viewBox="0 0 40 56"
          width="28"
          height="38"
          fill="none"
          aria-hidden="true"
          style={{ flexShrink: 0, marginBottom: "2px" }}
        >
          {/* ── Flor de loto encima del frasco ── */}
          {/* Pétalo izquierdo exterior */}
          <path d="M20 20 C17 14 11 13 9 8 C10 14 15 17 20 19" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="0.8"/>
          {/* Pétalo izquierdo interior */}
          <path d="M20 20 C18 13 16 10 15 6 C16 11 18 15 20 18" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="0.8"/>
          {/* Pétalo central */}
          <path d="M20 20 C20 12 20 9 20 5 C20 9 20 13 20 18" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="0.9"/>
          {/* Pétalo derecho interior */}
          <path d="M20 20 C22 13 24 10 25 6 C24 11 22 15 20 18" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="0.8"/>
          {/* Pétalo derecho exterior */}
          <path d="M20 20 C23 14 29 13 31 8 C30 14 25 17 20 19" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="0.8"/>

          {/* ── Frasco de perfume ── */}
          {/* Tapón/stopper */}
          <rect x="16" y="18" width="8" height="5" rx="1" fill="white" stroke={color} strokeWidth="1"/>
          {/* Cuello */}
          <rect x="17.5" y="23" width="5" height="4" rx="0.5" fill="white" stroke={color} strokeWidth="1"/>
          {/* Cuerpo redondeado */}
          <path d="M11 27 Q9 27 9 30 L9 48 Q9 52 13 52 L27 52 Q31 52 31 48 L31 30 Q31 27 29 27 Z"
            fill="white" stroke={color} strokeWidth="1.1"/>
          {/* Línea decorativa */}
          <line x1="13" y1="37" x2="27" y2="37" stroke={color} strokeWidth="0.7" opacity="0.6"/>
          {/* Etiqueta ovalada */}
          <ellipse cx="20" cy="44" rx="7" ry="5" stroke={color} strokeWidth="0.8" fill="none" opacity="0.55"/>
        </svg>
      </span>

      {/* Descriptor */}
      <span style={{
        fontFamily: "'Raleway', 'Helvetica Neue', Arial, sans-serif",
        fontSize: "clamp(7px, 0.9vw, 9.5px)",
        fontWeight: 300,
        color,
        letterSpacing: "0.2em",
        marginTop: "4px",
        opacity: 0.9,
      }}>
        Peluquería&nbsp;•&nbsp;Estética&nbsp;•&nbsp;Perfumes
      </span>
    </span>
  );
}

