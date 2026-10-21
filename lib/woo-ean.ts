// GTIN/EAN extraction from WooCommerce meta_data. WooCommerce has no native
// EAN field, so shops keep it in postmeta with plugin-specific keys.

export type WooMeta = { key?: string; value?: unknown };

const CLAVES_EAN = [
  "_ean", "ean", "_ean13", "ean13",
  "_gtin", "gtin", "_gtin13", "gtin13",
  "_barcode", "barcode",
  "codigo de barras", "codigo_barras",
];

/** GTINs are numeric: EAN-8, UPC-A (12), EAN-13 or ITF-14. */
export function eanDeMeta(meta?: WooMeta[] | null): string | null {
  for (const m of meta ?? []) {
    const clave = String(m?.key ?? "").trim().toLowerCase();
    if (!CLAVES_EAN.includes(clave)) continue;
    const valor = String(m?.value ?? "").trim();
    if (/^\d{8}$|^\d{12,14}$/.test(valor)) return valor;
  }
  return null;
}
