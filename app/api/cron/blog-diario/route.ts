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

    // 2-5. Generar los posts del día; seleccionarKeyword evita repetir keywords recientes
    const POSTS_POR_DIA = 2;
    const guardados = [];
    for (let i = 0; i < POSTS_POR_DIA; i++) {
      const keyword = await seleccionarKeyword(candidates);
      console.log(`[blog-diario] Post ${i + 1}/${POSTS_POR_DIA} — keyword "${keyword.keyword}" (${keyword.tipo})`);

      const productos = await obtenerProductosRelacionados(keyword.keyword);
      const productosContexto = [
        ...new Set([...productos, ...keyword.productos_relacionados]),
      ].slice(0, 8);

      const post = await generarPostConGemini(keyword, productosContexto);
      console.log(`[blog-diario] Post generado: "${post.titulo}"`);

      const { data: saved, error } = await supa
        .from("posts")
        .insert({
          titulo: post.titulo,
          slug: post.slug,
          resumen: post.resumen,
          contenido_html: post.contenido_html,
          seo_title: post.seo_title,
          seo_description: post.seo_description,
          keywords: post.keywords,
          publicado: false, // Borrador — el admin revisa y publica
          autor: "Esencia de Belleza",
        })
        .select("id, titulo, slug")
        .single();

      if (error) {
        throw new Error(`Error guardando post: ${error.message}`);
      }

      console.log(`[blog-diario] Post guardado como borrador: ${saved.id}`);
      guardados.push({
        id: saved.id,
        titulo: saved.titulo,
        slug: saved.slug,
        keyword: keyword.keyword,
        tipo_keyword: keyword.tipo,
        estado: "borrador",
      });
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
