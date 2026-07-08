import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return NextResponse.json({
    "NEXT_PUBLIC_SUPABASE_URL": url ? "✓ Configured" : "✗ Missing",
    "SUPABASE_SERVICE_ROLE_KEY": key ? "✓ Configured" : "✗ Missing",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
}
