import { crearSubcategoria } from "@/actions/categorias";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Crear sprays
    const res = await crearSubcategoria({
      categoria: "peluqueria",
      slug: "sprays",
      label: "Sprays",
      columna: "Styling",
      orden: 13,
      seo_title: "Sprays para el cabello",
      seo_description: "Compra sprays para cabello online",
    });

    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: "Subcategoría 'sprays' creada",
      data: res.data,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
