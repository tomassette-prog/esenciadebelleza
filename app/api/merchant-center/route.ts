import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { verificarAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const claude = new Anthropic();

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

export async function POST(request: NextRequest) {
  try {
    // Verificar admin
    try {
      await verificarAdmin();
    } catch (authError) {
      return NextResponse.json(
        { error: String(authError) },
        { status: 401 }
      );
    }

    // Parsear JSON del body
    const body = await request.json();
    const { productos } = body;

    if (!Array.isArray(productos)) {
      return NextResponse.json(
        { error: "Se espera un array de productos" },
        { status: 400 }
      );
    }

    console.log(`📊 Procesando ${productos.length} productos`);

    // Verificar que SUPABASE_SERVICE_ROLE_KEY esté disponible
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceKey || !url) {
      console.error("❌ Variables de entorno faltantes:");
      console.error("  SUPABASE_SERVICE_ROLE_KEY:", serviceKey ? "✓" : "✗");
      console.error("  NEXT_PUBLIC_SUPABASE_URL:", url ? "✓" : "✗");
      
      return NextResponse.json(
        {
          error: "Faltan variables de entorno en Vercel. Contacta al administrador.",
          detalles:
            "Las variables SUPABASE_SERVICE_ROLE_KEY y/o NEXT_PUBLIC_SUPABASE_URL no están configuradas",
        },
        { status: 500 }
      );
    }

    // Procesar cada producto
    const resultados: any[] = [];
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
            nombre: producto.nombre,
            ok: false,
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

        if (!result.error && result.data) {
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

          if (!result.error && result.data) {
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

          if (!result.error && result.data) {
            updated = true;
          } else if (result.error) {
            finalError = result.error;
          }
        }

        if (updated) {
          resultados.push({
            nombre: producto.nombre,
            ok: true,
            descripcionGenerada,
          });
        } else {
          resultados.push({
            nombre: producto.nombre,
            ok: false,
            error: finalError ? `Error: ${finalError.message}` : "Producto no encontrado",
          });
        }

        // Rate limiting
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        resultados.push({
          nombre: producto.nombre,
          ok: false,
          error: String(err),
        });
      }
    }

    const exitosos = resultados.filter((r) => r.ok).length;
    const fallidos = resultados.filter((r) => !r.ok).length;

    return NextResponse.json({
      totalProcesados: productos.length,
      exitosos,
      fallidos,
      detalles: resultados,
    });
  } catch (error) {
    console.error("Error en merchant-center API:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
