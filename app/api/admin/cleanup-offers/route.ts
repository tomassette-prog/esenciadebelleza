import { NextResponse } from "next/server";
import { limpiarOfertasInconsistentes } from "@/actions/importar";

export async function POST() {
  const result = await limpiarOfertasInconsistentes();
  return NextResponse.json(result);
}
