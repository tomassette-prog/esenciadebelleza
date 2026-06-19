"use client";

export function LogoEsencia({ className = "" }: { className?: string }) {
  const c = "#C4857A";
  const cDe = "#8B4A3F";
  const font = "var(--font-cormorant), 'Cormorant Garamond', Georgia, serif";
  const sz = "clamp(20px, 3vw, 30px)";
  return (
    <span className={`inline-flex flex-col items-start leading-none select-none ${className}`}>
      <span className="flex items-center" style={{ gap: "5px" }}>
        <span style={{ display: "flex", alignItems: "baseline", lineHeight: 1 }}>
          <span style={{ fontFamily: font, fontSize: sz, fontWeight: 300, color: c, letterSpacing: "0.02em" }}>esencia</span>
          <span style={{ fontFamily: font, fontSize: sz, fontWeight: 700, fontStyle: "italic", color: cDe }}>de</span>
          <span style={{ fontFamily: font, fontSize: sz, fontWeight: 300, color: c, letterSpacing: "0.02em" }}>belleza.es</span>
        </span>
        <svg viewBox="0 0 44 54" width="30" height="37" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginBottom: "1px" }}>
          <path d="M22 19 C19 19 17 15 17 11 C17 7 19 4 22 4 C25 4 27 7 27 11 C27 15 25 19 22 19Z" fill={c} fillOpacity="0.3" stroke={c} strokeWidth="0.9"/>
          <path d="M22 19 C20 18 16 16 14 12 C12 9 12 5 15 4 C18 3 21 5 22 9 C23 12 23 17 22 19Z" fill={c} fillOpacity="0.25" stroke={c} strokeWidth="0.9"/>
          <path d="M22 19 C24 18 28 16 30 12 C32 9 32 5 29 4 C26 3 23 5 22 9 C21 12 21 17 22 19Z" fill={c} fillOpacity="0.25" stroke={c} strokeWidth="0.9"/>
          <path d="M22 19 C21 17 17 17 13 15 C9 13 7 10 9 7 C11 4 15 4 18 7 C20 9 22 15 22 19Z" fill={c} fillOpacity="0.2" stroke={c} strokeWidth="0.8"/>
          <path d="M22 19 C23 17 27 17 31 15 C35 13 37 10 35 7 C33 4 29 4 26 7 C24 9 22 15 22 19Z" fill={c} fillOpacity="0.2" stroke={c} strokeWidth="0.8"/>
          <rect x="17" y="19" width="10" height="5" rx="1.5" fill="white" stroke={c} strokeWidth="1"/>
          <rect x="19" y="24" width="6" height="5" rx="0.8" fill="white" stroke={c} strokeWidth="1"/>
          <ellipse cx="22" cy="43" rx="13" ry="10" fill="white" stroke={c} strokeWidth="1.1"/>
          <line x1="12" y1="43" x2="32" y2="43" stroke={c} strokeWidth="0.7" opacity="0.5"/>
          <ellipse cx="22" cy="46" rx="7" ry="3.5" fill="none" stroke={c} strokeWidth="0.7" opacity="0.5"/>
        </svg>
      </span>
      <span style={{ fontFamily: "'Raleway','Helvetica Neue',Arial,sans-serif", fontSize: "clamp(7px, 0.85vw, 9px)", fontWeight: 300, color: c, letterSpacing: "0.2em", marginTop: "4px", opacity: 0.9 }}>
        {"Peluquer\u00eda \u2022 Est\u00e9tica \u2022 Perfumes"}
      </span>
    </span>
  );
}
