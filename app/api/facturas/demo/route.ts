import { NextResponse } from "next/server";
import { DatosFactura, generarHtmlFactura } from "@/lib/factura-generator";

/**
 * GET /api/facturas/demo
 * Genera una factura de ejemplo con datos ficticios.
 */
export async function GET() {
  const ahora = new Date().toISOString();

  const demo: DatosFactura = {
    numero: "EB-2026-00042",
    fecha: ahora,

    empresa: {
      nombre: "Sandra Navarro Torres",
      nif: "44871676X",
      direccion: "C/ Torero Antonio Carpio, 13-12",
      cp: "46470",
      ciudad: "Catarroja",
      provincia: "Valencia",
      telefono: "622 004 408",
      email: "info@esenciadebelleza.es",
      web: "esenciadebelleza.es",
    },

    cliente: {
      nombre: "María",
      apellidos: "García López",
      nif_cif: "12345678A",
      direccion: "Av. de la Constitución, 42",
      cp: "29001",
      ciudad: "Málaga",
      provincia: "Málaga",
      email: "maria.garcia@email.com",
      telefono: "612 345 678",
    },

    pedidoId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    metodoPago: "Tarjeta (Stripe)",

    lineas: [
      {
        nombre: "Fanola Botugen Champú Reconstructor",
        variacion: "1000 ml",
        sku: "FAN-BOT-SH-1000",
        cantidad: 2,
        precio_unitario: 12.95,
        subtotal: 25.9,
      },
      {
        nombre: "Yunsey Professional Máscara Capilar Nutritiva",
        variacion: "500 ml",
        sku: "YUN-MASK-NUT-500",
        cantidad: 1,
        precio_unitario: 18.5,
        subtotal: 18.5,
      },
      {
        nombre: "L'Oréal Professionnel Série Expert Absolut Repair",
        variacion: "Gold Quinoa + Protein — 250 ml",
        sku: "LOR-ABS-REP-250",
        cantidad: 3,
        precio_unitario: 14.9,
        subtotal: 44.7,
      },
      {
        nombre: "Revlon Professional Equave Instant Beauty",
        variacion: "Condicionador sin enjuague — 200 ml",
        sku: "REV-EQV-BEA-200",
        cantidad: 1,
        precio_unitario: 9.75,
        subtotal: 9.75,
      },
    ],

    subtotal: 98.85,
    descuento: 5.0,
    gastosEnvio: 0,
    total: 93.85,
    tipoIva: 21,
    recargoEquivalencia: 5.2,
    formaPago: "Transferencia bancaria",
    vencimiento: "30 días",
    iban: "ES12 3456 7890 1234 5678 9012",
    notas: "Gracias por su compra. Cualquier consulta, contacte con nosotros.",
    logoUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://esenciadebelleza.es"}/logo.svg`,
  };

  const html = generarHtmlFactura(demo);

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
