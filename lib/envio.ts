// ── Zonas de envío (igual que depeluqueriaproductos.com) ─────────────────────

export type ZonaEnvio = "peninsula" | "valencia" | "baleares" | "no_disponible";

// Suplemento por contrarembolso (el transportista cobra un extra por cobrar en destino)
export const SUPLEMENTO_CONTRAREEMBOLSO = 3.00;

export function getZonaEnvio(provincia: string): ZonaEnvio {
  const p = provincia.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (p === "valencia") return "valencia";
  if (p === "baleares" || p === "illes balears") return "baleares";
  if (
    p.includes("palmas") || p.includes("tenerife") ||
    p === "ceuta" || p === "melilla"
  ) return "no_disponible";
  return "peninsula";
}

export function calcularGastoEnvio(totalProductos: number, provincia: string): number {
  const zona = getZonaEnvio(provincia);
  switch (zona) {
    case "no_disponible": return -1;        // señal de zona no cubierta
    case "baleares":      return 7;         // siempre 7 €
    case "valencia":      return totalProductos >= 35 ? 0 : 5;
    default:              return totalProductos >= 40 ? 0 : 5; // península
  }
}
