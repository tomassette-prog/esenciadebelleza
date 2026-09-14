"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function FacturaPedidoPage() {
  const params = useParams();
  const pedidoId = params.id as string;
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/facturas/${pedidoId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.text();
      })
      .then(setHtml)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [pedidoId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-neutral-300 border-t-[#C4857A] rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  return (
    <iframe
      srcDoc={html}
      style={{ width: "100%", height: "100vh", border: "none" }}
      title="Factura"
    />
  );
}
