import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'Endpoint de prueba para Xiaomi Mimo listo.',
    env: {
      hasApiUrl: Boolean(process.env.XIAOMI_MIMO_API_URL),
      hasApiKey: Boolean(process.env.XIAOMI_MIMO_API_KEY),
      model: process.env.XIAOMI_MIMO_MODEL || 'mimo',
    },
  });
}
