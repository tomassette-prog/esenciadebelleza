"use client";

import { useState } from "react";

interface Props {
  url: string;
  titulo: string;
  descripcion?: string;
  imagen?: string;
  className?: string;
  layout?: "horizontal" | "vertical";
}

export function BotonesCompartir({ url, titulo, descripcion = "", imagen = "", className = "", layout = "horizontal" }: Props) {
  const [copiado, setCopiado] = useState(false);

  const urlEncoded = encodeURIComponent(url);
  const tituloEncoded = encodeURIComponent(titulo);
  const descripcionEncoded = encodeURIComponent(descripcion);

  const redes = [
    {
      nombre: "WhatsApp",
      href: `https://wa.me/?text=${tituloEncoded}%20${urlEncoded}`,
      color: "#25D366",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      ),
    },
    {
      nombre: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${urlEncoded}`,
      color: "#1877F2",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
    },
    {
      nombre: "X / Twitter",
      href: `https://twitter.com/intent/tweet?text=${tituloEncoded}&url=${urlEncoded}`,
      color: "#000000",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
    },
    {
      nombre: "Pinterest",
      href: `https://pinterest.com/pin/create/button/?url=${urlEncoded}&media=${encodeURIComponent(imagen)}&description=${tituloEncoded}`,
      color: "#E60023",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
        </svg>
      ),
    },
  ];

  const copiarURL = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("input");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  return (
    <div className={`flex ${layout === "vertical" ? "flex-col" : "flex-wrap"} items-center gap-2 ${className}`}>
      <span className="text-xs tracking-widest uppercase text-neutral-400 mr-1">Compartir</span>

      {redes.map((red) => (
        <a
          key={red.nombre}
          href={red.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Compartir en ${red.nombre}`}
          title={`Compartir en ${red.nombre}`}
          className="w-8 h-8 flex items-center justify-center border border-neutral-200 text-neutral-500 hover:text-white hover:border-transparent transition-all duration-200"
          style={{ ["--hover-bg" as string]: red.color }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = red.color; (e.currentTarget as HTMLElement).style.color = "white"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; (e.currentTarget as HTMLElement).style.color = ""; }}
        >
          {red.icon}
        </a>
      ))}

      {/* Copiar enlace */}
      <button
        onClick={copiarURL}
        aria-label="Copiar enlace"
        title="Copiar enlace"
        className="w-8 h-8 flex items-center justify-center border border-neutral-200 text-neutral-500 hover:border-neutral-600 hover:text-neutral-900 transition-all duration-200"
      >
        {copiado ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-green-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
        )}
      </button>
    </div>
  );
}
