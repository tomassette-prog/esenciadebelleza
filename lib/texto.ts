// Accent-insensitive text matching helpers. Pair with the `nombre_norm`
// generated column (migration 035) so searches match regardless of accents.

export function sinTildes(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
