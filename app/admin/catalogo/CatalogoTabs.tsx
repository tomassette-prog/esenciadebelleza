"use client";

import { useState, type ReactNode } from "react";

const TABS = [
  { key: "subcategorias", label: "Subcategorías" },
  { key: "categorias", label: "Categorías WooCommerce" },
  { key: "marcas", label: "Marcas" },
] as const;

interface Props {
  subcategoriasContent: ReactNode;
  categoriasContent: ReactNode;
  marcasContent: ReactNode;
}

export function CatalogoTabs({ subcategoriasContent, categoriasContent, marcasContent }: Props) {
  const [activeTab, setActiveTab] = useState<string>("subcategorias");

  const contentMap: Record<string, ReactNode> = {
    subcategorias: subcategoriasContent,
    categorias: categoriasContent,
    marcas: marcasContent,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
        Catálogo
      </h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-neutral-200">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-xs tracking-widest uppercase transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-[#3D2018] text-[#3D2018] font-medium"
                : "border-transparent text-neutral-400 hover:text-neutral-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {TABS.map(tab => (
        <div key={tab.key} className={activeTab === tab.key ? "" : "hidden"}>
          {contentMap[tab.key]}
        </div>
      ))}
    </div>
  );
}
