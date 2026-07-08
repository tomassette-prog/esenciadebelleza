"use server";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

const claude = new Anthropic();
const ADMIN_EMAILS = ["ziarresamot@gmail.com"];

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
 * Verifica que el usuario sea admin leyendo cookies
 */
async function verificarAdmin(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("sb-yjanobsfzcwpusynvlun-auth-token")?.value;

    if (!authToken) {
      throw new Error("No autorizado: token no encontrado");
    }

    try {
      const parsed = JSON.parse(authToken);
      const email = parsed.user?.email || parsed.email;

      if (!ADMIN_EMAILS.includes(email)) {
        throw new Error(`No autorizado: ${email} no está en la lista de admins`);
      }
    } catch (parseError) {
      console.warn("⚠️  No se pudo parsear token auth:", parseError);
      throw new Error("No autorizado: token inválido");
    }
  } catch (error) {
    throw new Error(`Acceso denegado: ${String(error)}`);
  }
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
