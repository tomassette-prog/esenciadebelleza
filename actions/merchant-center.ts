"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";

const claude = new Anthropic();
const ADMIN_EMAILS = ["ziarresamot@gmail.com"];

async function verificarAdmin() {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("sb-yjanobsfzcwpusynvlun-auth-token")?.value;

    if (!authToken) {
      throw new Error("No autorizado: token no encontrado");
    }

    const parsed = JSON.parse(authToken);
    const email = parsed.user?.email || parsed.email;

    if (!ADMIN_EMAILS.includes(email)) {
      throw new Error(`No autorizado: ${email} no está en la lista de admins`);
    }

    return true;
  } catch (error) {
    console.error("Error en verificarAdmin:", error);
    throw new Error(`Acceso denegado: ${String(error)}`);
  }
}

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
 * Genera automáticamente una descripción enriquecida usando Claude
 * basada en el producto y qué campos faltan.
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
 * Enriquece un producto individual con IA
 */
export async function enriquecerProducto(
  input: EnriquecerProductoInput
): Promise<EnriquecerProductoOutput> {
  try {
    await verificarAdmin();

    // Generar descripción con IA
    const descripcionGenerada = await generarDescripcion(
      input.nombre,
      input.descripcionActual,
      input.queAgregar
    );

    if (!descripcionGenerada) {
      return {
        ok: false,
        mensaje: "No se pudo generar descripción",
        error: "Respuesta vacía de IA",
      };
    }

    // Crear cliente Supabase aquí (dentro del try)
    let supabase;
    try {
      supabase = createAdminClient();
    } catch (authError) {
      return {
        ok: false,
        mensaje: "Error de autenticación",
        error: `No se pudo inicializar cliente Supabase: ${String(authError)}`,
      };
    }

    // Intentar actualizar por woo_id primero (ID de Google Merchant Center)
    let { error, data } = await supabase
      .from("productos_padre")
      .update({
        descripcion: input.descripcionActual
          ? `${input.descripcionActual}\n\n${descripcionGenerada}`
          : descripcionGenerada,
        updated_at: new Date().toISOString(),
      })
      .eq("woo_id", input.productoId);

    if (error && error.code !== "PGRST116") {
      // Si hay error pero no es "relación no existe", devolver
      console.warn(`Error updating by woo_id: ${error.message}`);
    }

    // Si no encuentra por woo_id, intentar por id (UUID)
    if (!data || data.length === 0) {
      ({ error, data } = await supabase
        .from("productos_padre")
        .update({
          descripcion: input.descripcionActual
            ? `${input.descripcionActual}\n\n${descripcionGenerada}`
            : descripcionGenerada,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.productoId));

      if (error && error.code !== "PGRST116") {
        console.warn(`Error updating by id: ${error.message}`);
      }
    }

    // Si no encuentra por id, intentar por nombre
    if (!data || data.length === 0) {
      ({ error, data } = await supabase
        .from("productos_padre")
        .update({
          descripcion: input.descripcionActual
            ? `${input.descripcionActual}\n\n${descripcionGenerada}`
            : descripcionGenerada,
          updated_at: new Date().toISOString(),
        })
        .ilike("nombre", input.nombre));

      if (error && error.code !== "PGRST116") {
        console.warn(`Error updating by nombre: ${error.message}`);
      }
    }

    if (error) {
      return {
        ok: false,
        mensaje: "No se encontró el producto",
        error: `Producto no encontrado: ${input.nombre}`,
      };
    }

    return {
      ok: true,
      mensaje: "✅ Producto enriquecido",
      descripcionGenerada,
    };
  } catch (error) {
    return {
      ok: false,
      mensaje: "Error en enriquecimiento",
      error: String(error),
    };
  }
}

/**
 * Procesa un lote de productos desde CSV de Merchant Center
 */
export async function procesarLoteGoogleMerchant(
  productos: EnriquecerProductoInput[]
): Promise<{ exitosos: number; fallidos: number; detalles: EnriquecerProductoOutput[] }> {
  try {
    await verificarAdmin();

    const resultados: EnriquecerProductoOutput[] = [];

    for (const producto of productos) {
      const resultado = await enriquecerProducto(producto);
      resultados.push(resultado);

      // Rate limiting para no saturar Claude
      await new Promise((r) => setTimeout(r, 500));
    }

    const exitosos = resultados.filter((r) => r.ok).length;
    const fallidos = resultados.filter((r) => !r.ok).length;

    return {
      exitosos,
      fallidos,
      detalles: resultados,
    };
  } catch (error) {
    return {
      exitosos: 0,
      fallidos: productos.length,
      detalles: [
        {
          ok: false,
          mensaje: "Error al procesar lote",
          error: String(error),
        },
      ],
    };
  }
}
