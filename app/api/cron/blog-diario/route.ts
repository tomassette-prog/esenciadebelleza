import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  generarKeywordsCandidatas,
  seleccionarKeyword,
  generarPostConGemini,
  obtenerProductosRelacionados,
} from "@/lib/blog-generator";

export const maxDuration = 240;

const CRON_SECRET = process.env.CRON_SECRET;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  // Verificar autenticación
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supa = adminClient();

  try {
    // 1. Generar keywords candidatas (comunes a los posts de la tanda)
    console.log("[blog-diario] Generando keywords...");
    const candidates = await generarKeywordsCandidatas();
    console.log(`[blog-diario] ${candidates.length} keywords candidatas`);

    // Generar los posts del día; seleccionarKeyword evita repetir keywords recientes.
    // Se generan EN PARALELO y se guarda cada uno en cuanto termina: en serie no
    // caben dos generaciones largas de Gemini en el tiempo máximo de la función
    // y un corte a mitad de tanda perdería los posts ya terminados.
    const POSTS_POR_DIA = 2;
    const guardados: unknown[] = [];

    // La elección de keyword es solo lectura y rápida: se hace en serie para no
    // repetir keyword dentro de la tanda (en paralelo ambas verían la misma lista)
    const elegidas: string[] = [];
    const seleccionadas: Awaited<ReturnType<typeof seleccionarKeyword>>[] = [];
    for (let i = 0; i < POSTS_POR_DIA; i++) {
      const keyword = await seleccionarKeyword(candidates, elegidas);
      elegidas.push(keyword.keyword);
      seleccionadas.push(keyword);
    }

    const trabajos = seleccionadas.map(async (keyword, i) => {
      console.log(`[blog-diario] Post ${i + 1}/${POSTS_POR_DIA} — keyword "${keyword.keyword}" (${keyword.tipo})`);

      const productos = await obtenerProductosRelacionados(keyword.keyword);
      const productosContexto = [
        ...new Set([...productos, ...keyword.productos_relacionados]),
      ].slice(0, 8);

      const post = await generarPostConGemini(keyword, productosContexto);
      console.log(`[blog-diario] Post generado: "${post.titulo}"`);

      // keywords guarda también la keyword de origen para que seleccionarKeyword
      // la descarte en próximas tandas (el resto lo elige Gemini)
      const keywords = [keyword.keyword, post.keywords].filter(Boolean).join(", ");

      // Slug único: si Gemini reutiliza el slug de un post antiguo (colisión con
      // la restricción UNIQUE), se reintenta con sufijo en vez de perder el post
      let slug = post.slug;
      let saved: { id: string; titulo: string; slug: string } | null = null;
      let errorMsg = "";
      for (let intentoSlug = 0; intentoSlug < 3 && !saved; intentoSlug++) {
        const { data, error } = await supa
          .from("posts")
          .insert({
            titulo: post.titulo,
            slug,
            resumen: post.resumen,
            contenido_html: post.contenido_html,
            seo_title: post.seo_title,
            seo_description: post.seo_description,
            keywords,
            publicado: false, // Borrador — el admin revisa y publica
            autor: "Esencia de Belleza",
          })
          .select("id, titulo, slug")
          .single();

        if (!error) {
          saved = data;
        } else if (error.code === "23505") {
          slug = `${post.slug}-${intentoSlug + 2}`;
        } else {
          errorMsg = error.message;
          break;
        }
      }
      if (!saved) {
        throw new Error(`Error guardando post: ${errorMsg || "slug duplicado tras reintentos"}`);
      }

      console.log(`[blog-diario] Post guardado como borrador: ${saved.id}`);
      const resultado = {
        id: saved.id,
        titulo: saved.titulo,
        slug: saved.slug,
        keyword: keyword.keyword,
        tipo_keyword: keyword.tipo,
        estado: "borrador",
      };
      guardados.push(resultado);
      return resultado;
    });

    const resultados = await Promise.allSettled(trabajos);
    const fallos = resultados
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => String(r.reason));
    if (fallos.length) {
      console.error(`[blog-diario] ${fallos.length} post(s) fallaron:`, fallos);
    }
    if (guardados.length === 0) {
      throw new Error(fallos[0] ?? "Ningún post generado");
    }

    return NextResponse.json({ ok: true, posts: guardados });
  } catch (err) {
    console.error("[blog-diario] Error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
