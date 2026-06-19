"use client";

export function LogoEsencia({ className = "" }: { className?: string }) {
  const c = "#C4857A";       // rosa principal
  const cDe = "#8B4A3F";    // rosa oscuro para "de"
  const font = "var(--font-cormorant), 'Cormorant Garamond', Georgia, serif";
  const sz = "clamp(20px, 3vw, 30px)";

  return (
    <span className={`inline-flex flex-col items-start leading-none select-none ${className}`}>
      <span className="flex items-center" style={{ gap: "5px" }}>

        {/* ── Texto ── */}
        <span style={{ display: "flex", alignItems: "baseline", lineHeight: 1 }}>
          <span style={{ fontFamily: font, fontSize: sz, fontWeight: 300, color: c, letterSpacing: "0.02em" }}>esencia</span>
          <span style={{ fontFamily: font, fontSize: sz, fontWeight: 700, fontStyle: "italic", color: cDe }}>de</span>
          <span style={{ fontFamily: font, fontSize: sz, fontWeight: 300, color: c, letterSpacing: "0.02em" }}>belleza.es</span>
        </span>

        {/* ── Icono: frasco perfume + flor de loto ── */}
        {/*
          Coordenadas (viewBox 0 0 44 54):
          - Flor: centro (22, 19). Pétalos tipo gota apuntando hacia afuera desde el centro.
          - Frasco: óvalo ancho cx=22 cy=43, cuello y tapón encima.
        */}
        <svg viewBox="0 0 44 54" width="30" height="37" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginBottom: "1px" }}>

          {/* Pétalos de loto — 5 gotas redondeadas en abanico */}
          {/* Pétalo central (arriba) */}
          <path d="M22 19 C19 19 17 15 17 11 C17 7 19 4 22 4 C25 4 27 7 27 11 C27 15 25 19 22 19Z"
            fill={c} fillOpacity="0.3" stroke={c} strokeWidth="0.9"/>
          {/* Pétalo izquierdo interior — rotado ~35° */}
          <path d="M22 19 C20 18 16 16 14 12 C12 9 12 5 15 4 C18 3 21 5 22 9 C23 12 23 17 22 19Z"
            fill={c} fillOpacity="0.25" stroke={c} strokeWidth="0.9"/>
          {/* Pétalo derecho interior — rotado ~-35° */}
          <path d="M22 19 C24 18 28 16 30 12 C32 9 32 5 29 4 C26 3 23 5 22 9 C21 12 21 17 22 19Z"
            fill={c} fillOpacity="0.25" stroke={c} strokeWidth="0.9"/>
          {/* Pétalo izquierdo exterior — rotado ~65° */}
          <path d="M22 19 C21 17 17 17 13 15 C9 13 7 10 9 7 C11 4 15 4 18 7 C20 9 22 15 22 19Z"
            fill={c} fillOpacity="0.2" stroke={c} strokeWidth="0.8"/>
          {/* Pétalo derecho exterior — rotado ~-65° */}
          <path d="M22 19 C23 17 27 17 31 15 C35 13 37 10 35 7 C33 4 29 4 26 7 C24 9 22 15 22 19Z"
            fill={c} fillOpacity="0.2" stroke={c} strokeWidth="0.8"/>

          {/* Tapón */}
          <rect x="17" y="19" width="10" height="5" rx="1.5" fill="white" stroke={c} strokeWidth="1"/>
          {/* Cuello */}
          <rect x="19" y="24" width="6" height="5" rx="0.8" fill="white" stroke={c} strokeWidth="1"/>
          {/* Cuerpo del frasco — óvalo ancho */}
          <ellipse cx="22" cy="43" rx="13" ry="10" fill="white" stroke={c} strokeWidth="1.1"/>
          {/* Línea horizontal decorativa */}
          <line x1="12" y1="43" x2="32" y2="43" stroke={c} strokeWidth="0.7" opacity="0.5"/>
          {/* Pequeña etiqueta */}
          <ellipse cx="22" cy="46" rx="7" ry="3.5" fill="none" stroke={c} strokeWidth="0.7" opacity="0.5"/>
        </svg>

      </span>

      {/* Descriptor */}
      <span style={{
        fontFamily: "'Raleway','Helvetica Neue',Arial,sans-serif",
        fontSize: "clamp(7px, 0.85vw, 9px)",
        fontWeight: 300,
        color: c,
        letterSpacing: "0.2em",
        marginTop: "4px",
        opacity: 0.9,
      }}>
        Peluquería&nbsp;•&nbsp;Estética&nbsp;•&nbsp;Perfumes
      </span>
    </span>
  );
}


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

