import { obtenerCategoriaPairs } from "@/lib/categorias-dinamicas";

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

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function suggestCategory(
  wooCatName: string,
  productName: string
): Promise<CategorySuggestion> {
  const pairs = await obtenerCategoriaPairs();
  const normCat = normalize(wooCatName);
  const normProd = normalize(productName);

  let bestScore = 0;
  let bestPair = { categoria: "peluqueria", subcategoria: "peluqueria-general", label: "Peluquería › General" };

  for (const pair of pairs) {
    let score = 0;

    // Exact slug match (de-hyphenated) against cat name
    const slugFlat = pair.subcategoria.replace(/-/g, " ");
    if (normCat.includes(slugFlat)) {
      score += 100;
    } else {
      // Token matching (simple approximation, no tokens list in dynamic data)
      const tokens = pair.subcategoria.split("-").filter((t) => t.length > 2);
      for (const token of tokens) {
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

export async function getAllCategoriaPairs(): Promise<CategoriaPair[]> {
  return await obtenerCategoriaPairs();
}
