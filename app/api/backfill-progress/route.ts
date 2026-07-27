import { NextResponse } from "next/server";
import { getBackfillProgress } from "@/actions/importar";

export async function GET() {
  const progress = await getBackfillProgress();
  return NextResponse.json(progress);
}
