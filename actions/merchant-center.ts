"use server";

export interface EnriquecerProductoInput {
  productoId: string;
  nombre: string;
  descripcionActual?: string;
  queAgregar: string; // e.g. "Fórmula, Ingrediente, Beneficios"
}

export interface EnriquecerProductoOutput {
  ok: boolean;
  mensaje: string;
  descripcionGenerada?: string;
  error?: string;
}

/**
 * Procesa un lote de productos desde CSV de Merchant Center
 * Delega el trabajo a la ruta API /api/merchant-center
 */
export async function procesarLoteGoogleMerchant(
  productos: EnriquecerProductoInput[]
): Promise<{ exitosos: number; fallidos: number; detalles: EnriquecerProductoOutput[] }> {
  try {
    // Llamar a la ruta API en lugar de procesar aquí
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || "https://esenciadebelleza.es"}/api/merchant-center`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productos }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        exitosos: 0,
        fallidos: productos.length,
        detalles: productos.map((p) => ({
          ok: false,
          mensaje: "Error",
          error: error.error || "Error desconocido",
        })),
      };
    }

    const resultado = await response.json();
    return resultado;
  } catch (error) {
    return {
      exitosos: 0,
      fallidos: productos.length,
      detalles: productos.map((p) => ({
        ok: false,
        mensaje: "Error",
        error: String(error),
      })),
    };
  }
}
