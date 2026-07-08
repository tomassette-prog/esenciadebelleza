"use server";

import { crearSubcategoria } from "@/actions/categorias";

export async function crearSpray() {
  return await crearSubcategoria({
    categoria: "peluqueria",
    slug: "sprays",
    label: "Sprays",
    columna: "Styling",
    orden: 13,
    seo_title: "Sprays para el cabello",
    seo_description: "Compra sprays para cabello online",
  });
}
