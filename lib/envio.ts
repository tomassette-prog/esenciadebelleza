// ── Zonas de envío (igual que depeluqueriaproductos.com) ─────────────────────

export type ZonaEnvio = "peninsula" | "valencia" | "baleares" | "ibiza" | "no_disponible";

// Importe mínimo para envío gratis en península (también usado por el nudge del carrito)
export const ENVIO_GRATIS_DESDE = 40;

// Packs con envío gratuito promocional (campaña activa)
export const ENVIO_GRATIS_PACK_SLUGS = ["pack-cebolla-anticaida"];

export function envioGratisPorPack(packs: { slug: string }[]): boolean {
  return packs.some((p) => ENVIO_GRATIS_PACK_SLUGS.includes(p.slug));
}

// Suplemento por contrarembolso (el transportista cobra un extra por cobrar en destino)
export const SUPLEMENTO_CONTRAREEMBOLSO = 3.00; // pedidos >= 40 €
export const SUPLEMENTO_CONTRAREEMBOLSO_BAJO = 7.50; // pedidos < 40 €

export function getSuplementoContrareembolso(totalProductos: number): number {
  return totalProductos >= 40 ? SUPLEMENTO_CONTRAREEMBOLSO : SUPLEMENTO_CONTRAREEMBOLSO_BAJO;
}

export function getZonaEnvio(provincia: string, ciudad: string = ""): ZonaEnvio {
  const p = provincia.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const c = ciudad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (p === "valencia") return "valencia";
  // Ibiza y Formentera: zona postal 078xx, más cara que Mallorca/Menorca
  if (
    p === "ibiza" || p === "eivissa" || p === "formentera" ||
    c.includes("ibiza") || c.includes("eivissa") || c.includes("formentera")
  ) return "ibiza";
  if (p === "baleares" || p === "illes balears") return "baleares";
  if (
    p.includes("palmas") || p.includes("tenerife") ||
    p === "ceuta" || p === "melilla"
  ) return "no_disponible";
  return "peninsula";
}

export function calcularGastoEnvio(totalProductos: number, provincia: string, ciudad: string = "", promoGratis: boolean = false): number {
  const zona = getZonaEnvio(provincia, ciudad);
  if (zona === "no_disponible") return -1;  // señal de zona no cubierta
  if (promoGratis) return 0;
  switch (zona) {
    case "ibiza":         return 12;        // Ibiza y Formentera: 12 €
    case "baleares":      return 7;         // Mallorca y Menorca: 7 €
    case "valencia":      return totalProductos >= 35 ? 0 : 5;
    default:              return totalProductos >= ENVIO_GRATIS_DESDE ? 0 : 5; // península
  }
}
