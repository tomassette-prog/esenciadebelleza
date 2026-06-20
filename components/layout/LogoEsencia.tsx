"use client";

export function LogoEsencia({ className = "" }: { className?: string }) {
  const c = "#C4857A";
  const cDe = "#8B4A3F";
  const font = "var(--font-cormorant), 'Cormorant Garamond', Georgia, serif";
  const sz = "clamp(20px, 3vw, 30px)";
  return (
    <span className={`inline-flex flex-col items-start leading-none select-none ${className}`}>
      <span className="flex items-center" style={{ gap: "8px" }}>
        {/* Logo circular de marca */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/favicon.svg"
          alt="Esencia de Belleza"
          aria-hidden="true"
          style={{ width: "clamp(32px, 4vw, 44px)", height: "clamp(32px, 4vw, 44px)", flexShrink: 0 }}
        />
        <span style={{ display: "flex", alignItems: "baseline", lineHeight: 1 }}>
          <span style={{ fontFamily: font, fontSize: sz, fontWeight: 300, color: c, letterSpacing: "0.02em" }}>esencia</span>
          <span style={{ fontFamily: font, fontSize: sz, fontWeight: 700, fontStyle: "italic", color: cDe }}>de</span>
          <span style={{ fontFamily: font, fontSize: sz, fontWeight: 300, color: c, letterSpacing: "0.02em" }}>belleza.es</span>
        </span>
      </span>
      <span style={{ fontFamily: "'Raleway','Helvetica Neue',Arial,sans-serif", fontSize: "clamp(7px, 0.85vw, 9px)", fontWeight: 300, color: c, letterSpacing: "0.2em", marginTop: "4px", opacity: 0.9, paddingLeft: "clamp(40px, 5vw, 52px)" }}>
        {"Peluquer\u00eda \u2022 Est\u00e9tica \u2022 Perfumes"}
      </span>
    </span>
  );
}
