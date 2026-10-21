// Permanent redirects for retired product/pack slugs: old campaign links,
// Merchant feed entries and indexed URLs must land on a live page, not on a 404.

const DESTINOS_RETIRADOS: Record<string, string> = {
  "pack-cebolla-anticaida": "/buscar?q=champu",
  "babaria-champu-de-cebolla-antioxidante-700-ml": "/buscar?q=champu",
};

export function destinoRetirado(slug: string): string | null {
  return DESTINOS_RETIRADOS[slug] ?? null;
}
