import { NAV_ITEMS } from "@/lib/categorias";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategorySuggestion {
  categoria: string;
  subcategoria: string;
  confidence: "high" | "medium" | "low";
}

export interface CategoriaPair {
  categoria: string;
  subcategoria: string;
  label: string;
}

// ─── Internal ────────────────────────────────────────────────────────────────

interface RawPair {
  categoria: string;
  subcategoria: string;
  categoriaLabel: string;
  subcategoriaLabel: string;
  tokens: string[];
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Build flat list of all categoria/subcategoria pairs from NAV_ITEMS once at module load
const ALL_PAIRS: RawPair[] = NAV_ITEMS.flatMap((item) => {
  if (!item.columnas) return [];
  const categoria = item.href.split("/")[2] ?? "";
  const categoriaLabel = item.label;
  return item.columnas.flatMap((col) =>
    col.links.map((link) => {
      const subcategoria = link.href.split("/")[3] ?? "";
      const tokens = subcategoria
        .split("-")
        .filter((t) => t.length > 2 && t !== "and" && t !== "los" && t !== "las" && t !== "una");
      return { categoria, subcategoria, categoriaLabel, subcategoriaLabel: link.label, tokens };
    })
  );
});

// ─── Public API ───────────────────────────────────────────────────────────────

export function suggestCategory(
  wooCatName: string,
  productName: string
): CategorySuggestion {
  const normCat = normalize(wooCatName);
  const normProd = normalize(productName);

  let bestScore = 0;
  let bestPair: RawPair = ALL_PAIRS[0];

  for (const pair of ALL_PAIRS) {
    let score = 0;

    // Exact slug match (de-hyphenated) against cat name
    const slugFlat = pair.subcategoria.replace(/-/g, " ");
    if (normCat.includes(slugFlat)) {
      score += 100;
    } else {
      // Token matching
      for (const token of pair.tokens) {
        if (normCat.includes(token)) score += 60;
        else if (normProd.includes(token)) score += 30;
        else if (normCat.includes(token.slice(0, 4)) || normProd.includes(token.slice(0, 4))) score += 10;
      }
    }

    // Tie-break: prefer categoria that appears in wooCatName
    if (score === bestScore && normCat.includes(pair.categoria.replace(/-/g, " "))) {
      score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestPair = pair;
    }
  }

  if (bestScore === 0) {
    return { categoria: "peluqueria", subcategoria: "peluqueria-general", confidence: "low" };
  }

  const confidence: CategorySuggestion["confidence"] =
    bestScore >= 80 ? "high" : bestScore >= 40 ? "medium" : "low";

  return {
    categoria: bestPair.categoria,
    subcategoria: bestPair.subcategoria,
    confidence,
  };
}

export function getAllCategoriaPairs(): CategoriaPair[] {
  return ALL_PAIRS.map((p) => ({
    categoria: p.categoria,
    subcategoria: p.subcategoria,
    label: `${p.categoriaLabel} › ${p.subcategoriaLabel}`,
  }));
}
