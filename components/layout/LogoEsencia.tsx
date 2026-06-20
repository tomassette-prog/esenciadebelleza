"use client";

export function LogoEsencia({ className = "" }: { className?: string }) {
  const c = "#C4857A";
  const cDe = "#8B4A3F";
  const teal = "#3D5A5C";
  const font = "var(--font-cormorant), 'Cormorant Garamond', Georgia, serif";
  const sz = "clamp(20px, 3vw, 30px)";
  return (
    <span className={`inline-flex flex-col items-start leading-none select-none ${className}`}>
      <span className="flex items-center" style={{ gap: "8px" }}>
        {/* Logo circular botánico inline */}
        <svg viewBox="0 0 48 48" width="40" height="40" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
          {/* Círculo exterior teal */}
          <circle cx="24" cy="24" r="22" stroke={teal} strokeWidth="1.8" fill="none" opacity="0.9"/>
          {/* Arco interno izquierdo rose gold */}
          <path d="M24 8 C17 10,11 16,10 24 C9 32,14 39,20 42" stroke={c} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.85"/>
          {/* Arco interno derecho rose gold */}
          <path d="M24 8 C31 10,37 16,38 24 C39 32,34 39,28 42" stroke={c} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.85"/>
          {/* Hoja izquierda */}
          <ellipse cx="8" cy="20" rx="5" ry="2.5" fill={teal} opacity="0.8" transform="rotate(-30 8 20)"/>
          {/* Hoja derecha */}
          <ellipse cx="40" cy="20" rx="5" ry="2.5" fill={teal} opacity="0.8" transform="rotate(30 40 20)"/>
          {/* Hoja superior izquierda */}
          <ellipse cx="13" cy="10" rx="4" ry="2" fill={teal} opacity="0.7" transform="rotate(-50 13 10)"/>
          {/* Hoja superior derecha */}
          <ellipse cx="35" cy="10" rx="4" ry="2" fill={teal} opacity="0.7" transform="rotate(50 35 10)"/>
          {/* Gota central */}
          <path d="M24 14 C21 19,17 23,17 27 C17 31,20 34,24 34 C28 34,31 31,31 27 C31 23,27 19,24 14Z"
            fill={c} fillOpacity="0.25" stroke={c} strokeWidth="1.2"/>
          {/* Brillo gota */}
          <path d="M22 19 C20 22,19 25,19.5 27" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>
        </svg>
        <span style={{ display: "flex", alignItems: "baseline", lineHeight: 1 }}>
          <span style={{ fontFamily: font, fontSize: sz, fontWeight: 300, color: c, letterSpacing: "0.02em" }}>esencia</span>
          <span style={{ fontFamily: font, fontSize: sz, fontWeight: 700, fontStyle: "italic", color: cDe }}>de</span>
          <span style={{ fontFamily: font, fontSize: sz, fontWeight: 300, color: c, letterSpacing: "0.02em" }}>belleza.es</span>
        </span>
      </span>
      <span style={{ fontFamily: "'Raleway','Helvetica Neue',Arial,sans-serif", fontSize: "clamp(7px, 0.85vw, 9px)", fontWeight: 300, color: c, letterSpacing: "0.2em", marginTop: "4px", opacity: 0.9, paddingLeft: "48px" }}>
        {"Peluquer\u00eda \u2022 Est\u00e9tica \u2022 Perfumes"}
      </span>
    </span>
  );
}
