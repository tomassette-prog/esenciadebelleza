"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verificarAdmin } from "@/lib/admin-auth";
import Anthropic from "@anthropic-ai/sdk";

const claude = new Anthropic();

export interface EnriquecerProductoInput {
  productoId: string;
  nombre: string;
  descripcionActual?: string;
  queAgregar: string;
}

export interface EnriquecerProductoOutput {
  ok: boolean;
  mensaje: string;
  descripcionGenerada?: string;
  error?: string;
}

/**
 * Genera una descripción enriquecida usando Claude
 */
async function generarDescripcion(
  nombre: string,
  descripcionActual: string | undefined,
  queAgregar: string
): Promise<string> {
  const prompt = `Eres un especialista en copywriting para productos de belleza y peluquería.
  
Producto: ${nombre}
Descripción actual: ${descripcionActual || "Sin descripción"}
Se necesita agregar: ${queAgregar}

Genera una descripción enriquecida que incluya exactamente lo solicitado.

Importante:
- Mantén un tono profesional y atractivo
- Sé conciso pero informativo (máx 500 caracteres)
- Si ya hay descripción, complétala; no la repliques
- Enfoca en lo que el cliente busca (resultados, no solo composición)

Devuelve SOLO el texto enriquecido, sin explicaciones.`;

  const response = await claude.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const text = response.content[0];
  if (text.type === "text") {
    return text.text.trim();
  }
  return "";
}

/**
 * Procesa un lote de productos desde CSV de Merchant Center
 * Se ejecuta íntegramente en servidor sin dependencias de API routes
 */
export async function procesarLoteGoogleMerchant(
  productos: EnriquecerProductoInput[]
): Promise<{ exitosos: number; fallidos: number; detalles: EnriquecerProductoOutput[] }> {
  try {
    // Verificar admin (local)
    try {
      await verificarAdmin();
    } catch (authError) {
      return {
        exitosos: 0,
        fallidos: productos.length,
        detalles: productos.map((p) => ({
          ok: false,
          mensaje: "Error",
          error: String(authError),
        })),
      };
    }

    console.log(`📊 Procesando ${productos.length} productos (Server Action)`);

    // Procesar cada producto
    const resultados: EnriquecerProductoOutput[] = [];

    for (const producto of productos) {
      try {
        // Generar descripción
        const descripcionGenerada = await generarDescripcion(
          producto.nombre,
          producto.descripcionActual,
          producto.queAgregar
        );

        if (!descripcionGenerada) {
          resultados.push({
            ok: false,
            mensaje: producto.nombre,
            error: "No se pudo generar descripción",
          });
          continue;
        }

        // Crear cliente y actualizar
        const supabase = createAdminClient();

        let updated = false;
        let finalError: any = null;

        // Intentar actualizar por woo_id primero
        let result = await supabase
          .from("productos_padre")
          .update({
            descripcion: producto.descripcionActual
              ? `${producto.descripcionActual}\n\n${descripcionGenerada}`
              : descripcionGenerada,
            updated_at: new Date().toISOString(),
          })
          .eq("woo_id", producto.productoId);

        if (!result.error) {
          updated = true;
        } else if (result.error) {
          finalError = result.error;
        }

        // Si no encuentra por woo_id, intentar por id
        if (!updated) {
          result = await supabase
            .from("productos_padre")
            .update({
              descripcion: producto.descripcionActual
                ? `${producto.descripcionActual}\n\n${descripcionGenerada}`
                : descripcionGenerada,
              updated_at: new Date().toISOString(),
            })
            .eq("id", producto.productoId);

          if (!result.error) {
            updated = true;
          } else if (result.error) {
            finalError = result.error;
          }
        }

        // Si no encuentra por id, intentar por nombre
        if (!updated) {
          result = await supabase
            .from("productos_padre")
            .update({
              descripcion: producto.descripcionActual
                ? `${producto.descripcionActual}\n\n${descripcionGenerada}`
                : descripcionGenerada,
              updated_at: new Date().toISOString(),
            })
            .ilike("nombre", producto.nombre);

          if (!result.error) {
            updated = true;
          } else if (result.error) {
            finalError = result.error;
          }
        }

        if (updated) {
          resultados.push({
            ok: true,
            mensaje: producto.nombre,
            descripcionGenerada,
          });
        } else {
          resultados.push({
            ok: false,
            mensaje: producto.nombre,
            error: finalError ? `Error: ${finalError.message}` : "Producto no encontrado",
          });
        }

        // Rate limiting
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        resultados.push({
          ok: false,
          mensaje: producto.nombre,
          error: String(err),
        });
      }
    }

    const exitosos = resultados.filter((r) => r.ok).length;
    const fallidos = resultados.filter((r) => !r.ok).length;

    return {
      exitosos,
      fallidos,
      detalles: resultados,
    };
  } catch (error) {
    console.error("❌ Error en procesarLoteGoogleMerchant:", error);
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

/**
 * Enriquece un ÚNICO producto con descripción mejorada
 * Se usa desde el formulario manual de Merchant Center
 */
export async function enriquecerProducto(
  input: EnriquecerProductoInput
): Promise<EnriquecerProductoOutput> {
  try {
    // Verificar admin
    await verificarAdmin();

    // Generar descripción
    const descripcionGenerada = await generarDescripcion(
      input.nombre,
      input.descripcionActual,
      input.queAgregar
    );

    if (!descripcionGenerada) {
      return {
        ok: false,
        mensaje: input.nombre,
        error: "No se pudo generar descripción",
      };
    }

    return {
      ok: true,
      mensaje: input.nombre,
      descripcionGenerada,
    };
  } catch (error) {
    console.error("❌ Error en enriquecerProducto:", error);
    return {
      ok: false,
      mensaje: input.nombre || "Error",
      error: String(error),
    };
  }
}

export interface CorregirErrorInput {
  nombre: string;
  tipoError: string; // e.g. "availability", "description", etc.
}

export interface CorregirErrorOutput {
  ok: boolean;
  nombre: string;
  accion: string;
  error?: string;
}

/**
 * Detecta el tipo de error y lo corrige:
 * - "availability" → activa las variaciones del producto en Supabase
 * - otros → genera descripción con IA
 */
export async function corregirErrorMerchant(
  input: CorregirErrorInput
): Promise<CorregirErrorOutput> {
  try {
    await verificarAdmin();
    const supabase = createAdminClient();

    // Google Merchant Center appends "Unidad" (and sometimes other suffixes) to product titles
    const nombreLimpio = input.nombre
      .replace(/\s*Unidad\s*$/i, '')
      .replace(/\s*Pack\s*$/i, '')
      .trim();

    if (input.tipoError.toLowerCase().includes("availability")) {
      // Estrategia de búsqueda progresiva para tolerar diferencias de formato
      const buscarProductos = async (termino: string) => {
        const { data, error } = await supabase
          .from("productos_padre")
          .select("id")
          .ilike("nombre", `%${termino}%`)
          .limit(10);
        return error ? [] : (data ?? []);
      };

      let productos = await buscarProductos(nombreLimpio);

      // Si no encuentra con nombre completo, buscar con las primeras 3 palabras clave
      if (!productos.length) {
        const palabras = nombreLimpio.split(/\s+/).filter(p => p.length > 2);
        if (palabras.length >= 2) {
          // Intento con 3 palabras primero, luego con 2
          for (let n = Math.min(3, palabras.length); n >= 2; n--) {
            const termino = palabras.slice(0, n).join(' ');
            productos = await buscarProductos(termino);
            if (productos.length) break;
          }
        }
      }

      if (!productos.length) {
        return {
          ok: false,
          nombre: input.nombre,
          accion: "availability",
          error: `Producto no encontrado (buscado: "${nombreLimpio}")`,
        };
      }

      // Activar todas las variaciones del producto
      const ids = productos.map((p: { id: string }) => p.id);
      const { error: updateError } = await supabase
        .from("productos_variaciones")
        .update({ activa: true })
        .in("producto_padre_id", ids);

      if (updateError) {
        return {
          ok: false,
          nombre: input.nombre,
          accion: "availability",
          error: updateError.message,
        };
      }

      return {
        ok: true,
        nombre: input.nombre,
        accion: "availability",
      };
    }

    // Para otros errores → generar descripción con IA
    const descripcionGenerada = await generarDescripcion(
      nombreLimpio,
      undefined,
      input.tipoError
    );

    if (!descripcionGenerada) {
      return {
        ok: false,
        nombre: input.nombre,
        accion: "description",
        error: "No se pudo generar descripción",
      };
    }

    const { error: updateError } = await supabase
      .from("productos_padre")
      .update({ descripcion: descripcionGenerada, updated_at: new Date().toISOString() })
      .ilike("nombre", `%${nombreLimpio}%`);

    if (updateError) {
      return {
        ok: false,
        nombre: input.nombre,
        accion: "description",
        error: updateError.message,
      };
    }

    return { ok: true, nombre: input.nombre, accion: "description" };
  } catch (error) {
    return {
      ok: false,
      nombre: input.nombre,
      accion: "unknown",
      error: String(error),
    };
  }
}

/**
 * Corrige en lote todos los errores del CSV de Merchant Center
 */
export async function corregirLoteMerchant(
  productos: CorregirErrorInput[]
): Promise<{ exitosos: number; fallidos: number; detalles: CorregirErrorOutput[] }> {
  const detalles: CorregirErrorOutput[] = [];

  for (const prod of productos) {
    const res = await corregirErrorMerchant(prod);
    detalles.push(res);
    // Small rate limit to avoid hammering DB
    await new Promise((r) => setTimeout(r, 100));
  }

  return {
    exitosos: detalles.filter((d) => d.ok).length,
    fallidos: detalles.filter((d) => !d.ok).length,
    detalles,
  };
}
