"use client";

import { useState, type ReactNode } from "react";

const TABS = [
  { key: "importar", label: "Importar" },
  { key: "merchant", label: "Merchant Center" },
] as const;

export function SuspenseSyncTabs({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<string>("importar");

  const childArray = Array.isArray(children) ? children : [children];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
        Sincronización
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
      {childArray.map((child, i) => {
        const tab = TABS[i];
        if (!tab) return null;
        return (
          <div key={tab.key} className={activeTab === tab.key ? "" : "hidden"}>
            {child}
          </div>
        );
      })}
    </div>
  );
}
