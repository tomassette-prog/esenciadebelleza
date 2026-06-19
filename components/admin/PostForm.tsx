"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useRef, useState, useCallback } from "react";
import { crearPost, actualizarPost } from "@/actions/blog";
import { subirImagenBlog } from "@/actions/blog-upload";
import { buscarProductosParaEnlace, type ProductoSugerido } from "@/actions/blog-search";

interface Post {
  id?: string;
  titulo?: string;
  slug?: string;
  resumen?: string;
  contenido_html?: string;
  seo_title?: string;
  seo_description?: string;
  imagen_url?: string | null;
  imagen_alt?: string | null;
  keywords?: string | null;
  social_facebook?: string | null;
  social_instagram?: string | null;
  social_tiktok?: string | null;
  publicado?: boolean;
  destacado?: boolean;
  autor?: string;
}

interface EnlaceProducto {
  id: string;
  nombre: string;
  urlActual: string;
  urlCorrecta: string;
  sugerencias?: ProductoSugerido[];
  buscando?: boolean;
}

interface Props {
  post?: Post;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 100);
}

/**
 * Convierte el texto/HTML mezclado que devuelve Gemini a HTML limpio y semántico.
 * Gemini a veces mezcla texto plano con HTML. Esta función:
 * 1. Divide el contenido en bloques separados por líneas en blanco
 * 2. Detecta si cada bloque es ya HTML o texto plano
 * 3. Convierte texto plano: líneas cortas → <h2>, texto largo → <p>
 * 4. Optimiza para SEO: H2 semánticos, párrafos limpios, sin spans vacíos
 */
function formatearHtmlGemini(raw: string): string {
  if (!raw) return "";

  // Si parece HTML bien formado (mayoría de bloques con tags), devolver limpio
  const yaHtml = (raw.match(/<(p|h[1-6]|ul|ol|table|div)[^>]*>/gi) ?? []).length;
  const totalLineas = raw.split("\n").filter(l => l.trim()).length;

  // Normalizar saltos de línea
  let texto = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  // Si el contenido ya es predominantemente HTML, solo hacer limpieza
  if (yaHtml / Math.max(totalLineas, 1) > 0.3) {
    return limpiarHtml(texto);
  }

  // Contenido principalmente texto plano → convertir
  const bloques = texto.split(/\n{2,}/);
  const resultado: string[] = [];

  for (const bloque of bloques) {
    const b = bloque.trim();
    if (!b) continue;

    // Bloque ya es HTML
    if (b.startsWith("<")) {
      resultado.push(limpiarHtml(b));
      continue;
    }

    // Líneas dentro del bloque
    const lineas = b.split("\n").map(l => l.trim()).filter(Boolean);

    if (lineas.length === 1) {
      const linea = lineas[0];
      // Línea corta sin punto al final = título de sección → H2
      if (linea.length < 100 && !linea.endsWith(".") && !linea.endsWith(",")) {
        resultado.push(`<h2>${linea}</h2>`);
      } else {
        resultado.push(`<p>${linea}</p>`);
      }
    } else {
      // Múltiples líneas: primera puede ser subtítulo
      const primera = lineas[0];
      const resto = lineas.slice(1).join(" ");

      if (primera.length < 100 && !primera.endsWith(".") && !primera.endsWith(",") && resto.length > 50) {
        resultado.push(`<h2>${primera}</h2>`);
        resultado.push(`<p>${resto}</p>`);
      } else {
        resultado.push(`<p>${lineas.join(" ")}</p>`);
      }
    }
  }

  return resultado.join("\n");
}

function limpiarHtml(html: string): string {
  return html
    // Eliminar atributos style/class vacíos
    .replace(/\s+(style|class)=""/gi, "")
    // Normalizar saltos de línea dentro de tags
    .replace(/<(p|h[1-6])[^>]*>\s*<\/(p|h[1-6])>/gi, "")
    // Eliminar spans vacíos
    .replace(/<span[^>]*>\s*<\/span>/gi, "")
    .trim();
}

function detectarEnlaces(html: string): Omit<EnlaceProducto, "id" | "urlCorrecta">[] {
  const encontrados: Omit<EnlaceProducto, "id" | "urlCorrecta">[] = [];
  const vistos = new Set<string>();

  // Patrón 1: <a href="...">[ENLACE_PRODUCTO: Nombre]
  const regexAnchor = /<a[^>]*href="([^"]*)"[^>]*>\s*\[ENLACE_PRODUCTO:\s*([^\]]+)\]/gi;
  let match;
  while ((match = regexAnchor.exec(html)) !== null) {
    const nombre = match[2].trim();
    if (!vistos.has(nombre)) {
      vistos.add(nombre);
      encontrados.push({ nombre, urlActual: match[1] });
    }
  }

  // Patrón 2: texto suelto [ENLACE_PRODUCTO: Nombre]
  const regexSuelto = /\[ENLACE_PRODUCTO:\s*([^\]]+)\]/gi;
  while ((match = regexSuelto.exec(html)) !== null) {
    const nombre = match[1].trim();
    if (!vistos.has(nombre)) {
      vistos.add(nombre);
      encontrados.push({ nombre, urlActual: "" });
    }
  }

  return encontrados;
}

function aplicarEnlaces(html: string, enlaces: EnlaceProducto[]): string {
  let result = html;
  for (const enlace of enlaces) {
    if (!enlace.urlCorrecta) continue;
    const nombreEscapado = enlace.nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Actualizar href en anchors existentes
    const regexAnchor = new RegExp(
      `<a([^>]*)href="[^"]*"([^>]*)>\\s*\\[ENLACE_PRODUCTO:\\s*${nombreEscapado}\\s*\\]`,
      "gi"
    );
    result = result.replace(regexAnchor, `<a$1href="${enlace.urlCorrecta}"$2>${enlace.nombre}`);

    // Texto suelto → crear anchor
    const regexSuelto = new RegExp(`\\[ENLACE_PRODUCTO:\\s*${nombreEscapado}\\s*\\]`, "gi");
    result = result.replace(regexSuelto, `<a href="${enlace.urlCorrecta}">${enlace.nombre}</a>`);
  }
  return result;
}

// ── Generador de contenido RRSS ───────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extraerPrimerParrafo(html: string): string {
  const m = html.match(/<p[^>]*>(.*?)<\/p>/i);
  return m ? stripHtml(m[1]).slice(0, 200) : stripHtml(html).slice(0, 200);
}

function generarHashtags(keywords: string, titulo: string): string {
  const base = (keywords || titulo)
    .split(",")
    .map((k) =>
      "#" +
      k.trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9]/g, "")
    )
    .filter((h) => h.length > 1)
    .slice(0, 8)
    .join(" ");
  return base;
}

interface SocialContent {
  facebook: string;
  instagram: string;
  tiktok: string;
}

function generarContenidoRRSS(
  titulo: string,
  resumen: string,
  contenidoHtml: string,
  keywords: string,
  slug: string
): SocialContent {
  const primerParrafo = extraerPrimerParrafo(contenidoHtml);
  const hashtags8 = generarHashtags(keywords, titulo);
  const urlPost = `esenciadebelleza.es/blog/${slug || "post"}`;

  // ── Facebook: informativo, conversacional, con enlace ──────────────────────
  const facebook = `✨ ${titulo}

${resumen || primerParrafo}

En nuestro nuevo artículo te explicamos todo lo que necesitas saber para tomar la mejor decisión. Tanto si eres profesional del sector como si simplemente quieres cuidar tu cabello en casa, este artículo es para ti.

👉 Léelo completo aquí: ${urlPost}

${hashtags8} #esenciadebelleza #peluqueriaprofesional #consejosdebeleza`;

  // ── Instagram: hook fuerte, emojis, CTA, hashtags ─────────────────────────
  const primerFrase = (resumen || primerParrafo).split(".")[0].trim();
  const instagram = `¿${primerFrase.endsWith("?") ? primerFrase : primerFrase + "?"}

${resumen || primerParrafo}

🔗 Enlace en bio para leer el artículo completo.

${hashtags8} #esenciadebelleza #peluqueria #estetica #bellezaprofesional #consejosdebeleza #haircare #beautycare #peluqueriamadrid #peluqueriaespana #productosprofesionales`;

  // ── TikTok: guión para vídeo corto, punchy, trending ──────────────────────
  const palabraClave = (keywords || titulo).split(",")[0].trim();
  const tiktok = `🎬 GUIÓN TIKTOK — "${titulo}"

[GANCHO - primeros 3 segundos]
"¿Sabes realmente la diferencia entre ${palabraClave}? Sigue mirando porque te vas a sorprender 👀"

[DESARROLLO - 20-40 segundos]
${primerParrafo.slice(0, 150)}...

Haz clic en el enlace de la bio para leer el artículo completo 👆

[CIERRE]
"Síguenos para más consejos de peluquería profesional"

📌 Hashtags:
${hashtags8} #esenciadebelleza #aprendeentiktok #consejosdepelo #peluqueria #foryou #fyp #viral`;

  return { facebook, instagram, tiktok };
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function PostForm({ post }: Props) {
  const isEdit = !!post?.id;
  const action = isEdit ? actualizarPost.bind(null, post!.id!) : crearPost;
  const [state, formAction] = useFormState(action, null);

  // Campos controlados
  const [titulo,        setTitulo]        = useState(post?.titulo ?? "");
  const [slug,          setSlug]          = useState(post?.slug ?? "");
  const [resumen,       setResumen]       = useState(post?.resumen ?? "");
  const [contenidoHtml, setContenidoHtml] = useState(post?.contenido_html ?? "");
  const [seoTitle,      setSeoTitle]      = useState(post?.seo_title ?? "");
  const [seoDesc,       setSeoDesc]       = useState(post?.seo_description ?? "");
  const [keywords,      setKeywords]      = useState(post?.keywords ?? "");
  const [imagenUrl,     setImagenUrl]     = useState(post?.imagen_url ?? "");
  const [imagenAlt,     setImagenAlt]     = useState(post?.imagen_alt ?? "");

  // Importador Gemini
  const [jsonInput,  setJsonInput]  = useState("");
  const [jsonError,  setJsonError]  = useState("");
  const [importOpen, setImportOpen] = useState(!isEdit);

  // Enlaces detectados
  const [enlaces, setEnlaces] = useState<EnlaceProducto[]>([]);
  const [enlacesAplicados, setEnlacesAplicados] = useState(false);

  // Upload imagen
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Previsualización
  const [previewOpen, setPreviewOpen] = useState(false);

  // Redes sociales
  const [socialFacebook,  setSocialFacebook]  = useState(post?.social_facebook  ?? "");
  const [socialInstagram, setSocialInstagram] = useState(post?.social_instagram ?? "");
  const [socialTiktok,    setSocialTiktok]    = useState(post?.social_tiktok    ?? "");
  const [rrssOpen,        setRrssOpen]        = useState(false);
  const [copiadoId,       setCopiadoId]       = useState<string | null>(null);

  function generarRRSS() {
    const contenido = generarContenidoRRSS(titulo, resumen, contenidoHtml, keywords, slug);
    setSocialFacebook(contenido.facebook);
    setSocialInstagram(contenido.instagram);
    setSocialTiktok(contenido.tiktok);
    setRrssOpen(true);
  }

  async function copiar(id: string, texto: string) {
    await navigator.clipboard.writeText(texto);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2000);
  }

  // ── Cargar JSON ────────────────────────────────────────────────────────────
  const cargarJson = useCallback(() => {
    setJsonError("");

    // Extraer solo el bloque JSON (por si hay texto antes/después)
    const raw = jsonInput.trim();
    const start = raw.indexOf("{");
    const end   = raw.lastIndexOf("}");
    if (start === -1 || end === -1) {
      setJsonError("No se encontró un bloque JSON { ... }. Asegúrate de pegar el JSON completo.");
      return;
    }
    const jsonBlock = raw.slice(start, end + 1);

    let data: Record<string, string>;
    try {
      data = JSON.parse(jsonBlock);
    } catch (firstError) {
      // Intento de reparación: Gemini a veces deja saltos de línea sin escapar
      // dentro de valores de string. Los reemplazamos por \n escapado.
      try {
        const fixed = jsonBlock
          // Reemplazar saltos de línea literales dentro de valores de string por \n
          .replace(/("(?:[^"\\]|\\.)*")|(\n)/g, (match, strMatch) => {
            if (strMatch) return strMatch; // dentro de string → mantener
            return "\\n"; // fuera de string → escapar
          });
        data = JSON.parse(fixed);
      } catch {
        // Último recurso: extraer campos campo por campo con regex
        try {
          data = {};
          const camposSimples = ["titulo", "slug", "resumen", "seo_title", "seo_description", "keywords"];
          for (const campo of camposSimples) {
            const m = jsonBlock.match(new RegExp(`"${campo}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
            if (m) data[campo] = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
          }
          // contenido_html puede ser muy largo — extraer entre primera " tras : y el último "
          const htmlStart = jsonBlock.indexOf('"contenido_html"');
          if (htmlStart !== -1) {
            const colonPos = jsonBlock.indexOf(":", htmlStart);
            const quoteStart = jsonBlock.indexOf('"', colonPos + 1);
            // Buscar el cierre: último " antes del siguiente campo o del }
            const nextField = jsonBlock.search(/"(?:titulo|slug|resumen|seo_title|seo_description|keywords|autor|publicado)"\s*:/);
            const searchEnd = nextField > quoteStart ? nextField : jsonBlock.length;
            const quoteEnd = jsonBlock.lastIndexOf('"', searchEnd - 2);
            if (quoteStart !== -1 && quoteEnd > quoteStart) {
              data.contenido_html = jsonBlock
                .slice(quoteStart + 1, quoteEnd)
                .replace(/\\n/g, "\n")
                .replace(/\\"/g, '"')
                .replace(/\\t/g, "\t");
            }
          }
          if (!data.titulo && !data.contenido_html) {
            throw new Error("No se pudo extraer ningún campo");
          }
        } catch {
          setJsonError(
            `JSON inválido: ${(firstError as Error).message}. ` +
            "Comprueba que el contenido_html no tiene comillas sin escapar. " +
            "Puedes pegar cada campo manualmente en los campos de abajo."
          );
          return;
        }
      }
    }

    if (data.titulo)          setTitulo(data.titulo);
    if (data.resumen)         setResumen(data.resumen);
    if (data.seo_title)       setSeoTitle(data.seo_title.slice(0, 60));
    if (data.seo_description) setSeoDesc(data.seo_description.slice(0, 160));
    if (data.keywords)        setKeywords(data.keywords);

    const slugBase = data.slug || data.titulo || "";
    setSlug(slugify(slugBase));

    // Formatear HTML: convierte texto plano a H2/P correctos
    const htmlBruto = data.contenido_html ?? "";
    const htmlFormateado = formatearHtmlGemini(htmlBruto);
    setContenidoHtml(htmlFormateado);

    // Auto-fill alt text de imagen con el título
    if (data.titulo) {
      setImagenAlt(data.titulo + " — Esencia de Belleza");
    }

    // Detectar enlaces en el HTML formateado y buscar en catálogo
    const detectados = detectarEnlaces(htmlFormateado);
    const enlacesIniciales: EnlaceProducto[] = detectados.map((e, i) => ({
      ...e,
      id: `link-${i}`,
      urlCorrecta: e.urlActual,
      sugerencias: [],
      buscando: false,
    }));
    setEnlaces(enlacesIniciales);
    setEnlacesAplicados(false);

    // Buscar automáticamente cada producto en el catálogo
    setTimeout(async () => {
      for (let i = 0; i < enlacesIniciales.length; i++) {
        const enlace = enlacesIniciales[i];
        const resultados = await buscarProductosParaEnlace(enlace.nombre);
        setEnlaces((prev) =>
          prev.map((l) =>
            l.id === enlace.id
              ? {
                  ...l,
                  sugerencias: resultados,
                  // Auto-seleccionar si solo hay 1 resultado
                  urlCorrecta: resultados.length === 1 ? resultados[0].url : l.urlCorrecta,
                }
              : l
          )
        );
      }
    }, 100);

    setImportOpen(false);
  }, [jsonInput]);

  // ── Aplicar URLs ───────────────────────────────────────────────────────────
  const aplicarUrls = useCallback(() => {
    setContenidoHtml((prev) => aplicarEnlaces(prev, enlaces));
    setEnlacesAplicados(true);
  }, [enlaces]);

  async function buscarEnlace(enlaceId: string, nombre: string) {
    setEnlaces((prev) => prev.map((l) => l.id === enlaceId ? { ...l, buscando: true } : l));
    const resultados = await buscarProductosParaEnlace(nombre);
    setEnlaces((prev) =>
      prev.map((l) =>
        l.id === enlaceId
          ? { ...l, sugerencias: resultados, buscando: false,
              urlCorrecta: resultados.length === 1 ? resultados[0].url : l.urlCorrecta }
          : l
      )
    );
  }

  // ── Upload imagen ──────────────────────────────────────────────────────────
  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setUploadMsg("Selecciona un archivo primero."); return; }
    setUploading(true);
    setUploadMsg("Subiendo...");
    const fd = new FormData();
    fd.append("imagen", file);
    fd.append("slug", slug || "post");
    const res = await subirImagenBlog(fd);
    setUploading(false);
    if (res.error) setUploadMsg("Error: " + res.error);
    else { setImagenUrl(res.url!); setUploadMsg("✓ Imagen subida correctamente"); }
  }

  return (
    <form action={formAction} className="space-y-6">

      {/* Error server */}
      {state?.error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm">{state.error}</div>
      )}

      {/* ═══ IMPORTADOR GEMINI ═══ */}
      <div className="border border-[#C9A84C]/40 bg-[#C9A84C]/5">
        <button
          type="button"
          onClick={() => setImportOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-3 text-left"
        >
          <span className="flex items-center gap-2 text-xs tracking-widest uppercase text-[#8B6914] font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
            </svg>
            {importOpen
              ? "Cerrar importador"
              : `📋 Pegar JSON de Gemini — rellena todos los campos automáticamente${titulo ? " ✓ cargado" : ""}`}
          </span>
          <span className="text-[#8B6914]">{importOpen ? "▲" : "▼"}</span>
        </button>

        {importOpen && (
          <div className="px-5 pb-5 space-y-3 border-t border-[#C9A84C]/30 pt-4">
            <p className="text-xs text-neutral-500">
              Pega aquí el JSON completo que devuelve Gemini (el bloque <code className="bg-neutral-100 px-1">{"{ ... }"}</code> entero).
              Se rellenarán <strong>título, slug, resumen, contenido y todos los campos SEO</strong>.
              Los productos a enlazar se detectan automáticamente.
            </p>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              rows={10}
              className="w-full border border-neutral-200 px-3 py-2.5 text-xs font-mono text-neutral-600 focus:outline-none focus:border-[#C9A84C] transition-colors resize-y bg-white"
              placeholder={'{\n  "titulo": "Keratina vs alisado brasileño...",\n  "slug": "keratina-vs-alisado...",\n  "resumen": "...",\n  "contenido_html": "<h2>...</h2><p>...</p>",\n  "seo_title": "...",\n  "seo_description": "...",\n  "keywords": "keratina, alisado..."\n}'}
            />
            {jsonError && <p className="text-xs text-red-600">{jsonError}</p>}
            <button
              type="button"
              onClick={cargarJson}
              disabled={!jsonInput.trim()}
              className="px-6 py-2.5 bg-[#C9A84C] text-white text-xs tracking-widest uppercase hover:bg-[#8B6914] disabled:opacity-40 transition-colors"
            >
              Cargar y rellenar formulario →
            </button>
          </div>
        )}
      </div>

      {/* ═══ ENLACES DE PRODUCTOS DETECTADOS ═══ */}
      {enlaces.length > 0 && (
        <div className={`border p-5 space-y-4 ${enlacesAplicados ? "border-green-200 bg-green-50" : "border-blue-200 bg-blue-50"}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs tracking-widest uppercase font-medium ${enlacesAplicados ? "text-green-800" : "text-blue-800"}`}>
                {enlacesAplicados
                  ? `✓ ${enlaces.length} enlace${enlaces.length > 1 ? "s" : ""} aplicado${enlaces.length > 1 ? "s" : ""} al contenido`
                  : `🔗 ${enlaces.length} enlace${enlaces.length > 1 ? "s" : ""} de producto detectado${enlaces.length > 1 ? "s" : ""} — introduce las URLs correctas`}
              </p>
              {!enlacesAplicados && (
                <p className="text-xs text-blue-600 mt-1">
                  Escribe la URL de cada producto y pulsa <strong>&quot;Aplicar enlaces&quot;</strong> cuando termines.
                  Puedes buscar el slug en tu tienda y pegarlo directamente.
                </p>
              )}
            </div>
          </div>

          {!enlacesAplicados && (
            <>
              <div className="space-y-4">
                {enlaces.map((enlace, idx) => (
                  <div key={enlace.id} className="bg-white border border-blue-100 p-4 space-y-3 rounded-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-neutral-800">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs mr-2">
                          {idx + 1}
                        </span>
                        {enlace.nombre}
                      </p>
                      <button
                        type="button"
                        onClick={() => buscarEnlace(enlace.id, enlace.nombre)}
                        disabled={enlace.buscando}
                        className="text-xs px-3 py-1 border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                      >
                        {enlace.buscando ? "Buscando..." : "🔍 Buscar en tienda"}
                      </button>
                    </div>

                    {/* Sugerencias del catálogo */}
                    {enlace.sugerencias && enlace.sugerencias.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-neutral-500">Productos encontrados en el catálogo:</p>
                        {enlace.sugerencias.map((s) => (
                          <button
                            key={s.url}
                            type="button"
                            onClick={() =>
                              setEnlaces((prev) =>
                                prev.map((l) => l.id === enlace.id ? { ...l, urlCorrecta: s.url } : l)
                              )
                            }
                            className={`w-full text-left px-3 py-2 text-xs border transition-colors ${
                              enlace.urlCorrecta === s.url
                                ? "border-blue-400 bg-blue-50 text-blue-800"
                                : "border-neutral-200 hover:border-blue-300 hover:bg-blue-50/50 text-neutral-700"
                            }`}
                          >
                            <span className="font-medium">{s.nombre}</span>
                            {s.marca && <span className="text-neutral-400 ml-1">· {s.marca}</span>}
                            <span className="block text-neutral-400 font-mono mt-0.5">{s.url}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {enlace.sugerencias && enlace.sugerencias.length === 0 && !enlace.buscando && enlace.sugerencias !== undefined && (
                      <p className="text-xs text-amber-600">
                        No se encontraron productos con ese nombre. Escribe la URL manualmente.
                      </p>
                    )}

                    {/* URL manual */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-400 shrink-0 w-20">URL elegida:</span>
                      <input
                        type="text"
                        value={enlace.urlCorrecta}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEnlaces((prev) =>
                            prev.map((l) => l.id === enlace.id ? { ...l, urlCorrecta: val } : l)
                          );
                        }}
                        className={`flex-1 border px-3 py-1.5 text-xs font-mono focus:outline-none transition-colors ${
                          enlace.urlCorrecta
                            ? "border-green-300 bg-green-50/30 focus:border-green-500"
                            : "border-neutral-200 focus:border-blue-400"
                        }`}
                        placeholder="/productos/categoria/subcategoria/slug-producto"
                      />
                    </div>
                    {enlace.urlActual && enlace.urlActual !== enlace.urlCorrecta && enlace.urlActual.startsWith("/") && (
                      <p className="text-xs text-neutral-400">
                        Gemini sugirió: <code className="text-neutral-500 bg-neutral-50 px-1">{enlace.urlActual}</code>
                        <button
                          type="button"
                          onClick={() => setEnlaces((prev) =>
                            prev.map((l) => l.id === enlace.id ? { ...l, urlCorrecta: enlace.urlActual } : l)
                          )}
                          className="ml-2 text-blue-500 underline"
                        >
                          usar esta
                        </button>
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={aplicarUrls}
                className="px-6 py-2.5 bg-blue-600 text-white text-xs tracking-widest uppercase hover:bg-blue-700 transition-colors"
              >
                ✓ Aplicar enlaces al contenido
              </button>
            </>
          )}

          {enlacesAplicados && (
            <button
              type="button"
              onClick={() => setEnlacesAplicados(false)}
              className="text-xs text-green-700 underline"
            >
              Volver a editar los enlaces
            </button>
          )}
        </div>
      )}

      {/* ═══ CAMPOS ═══ */}

      <div>
        <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">Título *</label>
        <input
          name="titulo"
          type="text"
          required
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value);
            if (!slug) setSlug(slugify(e.target.value));
          }}
          className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
          placeholder="Keratina vs alisado brasileño: ¿cuál elegir?"
        />
      </div>

      <div>
        <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
          Slug <span className="text-neutral-400 normal-case">(URL — se genera desde el título)</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400 shrink-0">/blog/</span>
          <input
            name="slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            className="flex-1 border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors font-mono text-neutral-500"
            placeholder="keratina-vs-alisado-brasileno"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
          Resumen <span className="text-neutral-400 normal-case">(vista previa en el listado)</span>
        </label>
        <textarea
          name="resumen"
          rows={3}
          value={resumen}
          onChange={(e) => setResumen(e.target.value)}
          className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors resize-none"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs tracking-wider uppercase text-neutral-600">Contenido HTML *</label>
          {enlaces.length > 0 && !enlacesAplicados && (
            <span className="text-xs text-amber-600">
              ⚠ Aplica los {enlaces.length} enlaces antes de publicar
            </span>
          )}
          {enlacesAplicados && (
            <span className="text-xs text-green-600">✓ Enlaces aplicados</span>
          )}
        </div>
        <textarea
          name="contenido_html"
          required
          rows={22}
          value={contenidoHtml}
          onChange={(e) => setContenidoHtml(e.target.value)}
          className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors resize-y font-mono text-xs text-neutral-600"
        />
      </div>

      {/* Imagen */}
      <div className="p-5 bg-neutral-50 border border-neutral-100 space-y-4">
        <p className="text-xs tracking-widest uppercase text-neutral-500">Imagen destacada</p>

        {imagenUrl && (
          <div className="w-full max-w-sm aspect-video bg-neutral-100 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagenUrl} alt="Preview" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
              Subir imagen <span className="text-neutral-400 normal-case">(JPG, PNG, WebP — máx 4 MB)</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="w-full text-sm text-neutral-600 file:mr-4 file:py-2 file:px-4 file:border file:border-neutral-300 file:text-xs file:tracking-wider file:uppercase file:bg-white file:text-neutral-700 hover:file:bg-neutral-50 file:cursor-pointer"
            />
          </div>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="px-5 py-2 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {uploading ? "Subiendo..." : "Subir imagen"}
          </button>
        </div>

        {uploadMsg && (
          <p className={`text-xs ${uploadMsg.startsWith("✓") ? "text-green-700" : "text-red-600"}`}>{uploadMsg}</p>
        )}

        <div>
          <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
            URL imagen <span className="text-neutral-400 normal-case">(se rellena al subir)</span>
          </label>
          <input
            name="imagen_url"
            type="url"
            value={imagenUrl}
            onChange={(e) => setImagenUrl(e.target.value)}
            className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 bg-white font-mono text-xs text-neutral-500"
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
            Alt text <span className="text-neutral-400 normal-case">(describe la imagen para Google Images — se rellena con el título)</span>
          </label>
          <input
            name="imagen_alt"
            type="text"
            value={imagenAlt}
            onChange={(e) => setImagenAlt(e.target.value)}
            className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 bg-white"
            placeholder="Mujer aplicando keratina en peluquería profesional"
          />
          <p className="text-xs text-neutral-400 mt-1">
            Incluye la keyword principal. Describe la imagen con detalle para SEO.
          </p>
        </div>
      </div>

      {/* SEO */}
      <div className="p-5 bg-neutral-50 border border-neutral-100 space-y-4">
        <p className="text-xs tracking-widest uppercase text-neutral-500">SEO</p>

        <div>
          <div className="flex justify-between mb-1.5">
            <label className="text-xs tracking-wider uppercase text-neutral-600">SEO Title *</label>
            <span className={`text-xs ${seoTitle.length > 60 ? "text-red-500" : seoTitle.length > 50 ? "text-amber-500" : "text-neutral-400"}`}>
              {seoTitle.length}/60
            </span>
          </div>
          <input
            name="seo_title"
            type="text"
            maxLength={60}
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 bg-white"
          />
          <p className="text-xs text-neutral-400 mt-1">Incluye la keyword principal. Ideal entre 50-60 caracteres.</p>
        </div>

        <div>
          <div className="flex justify-between mb-1.5">
            <label className="text-xs tracking-wider uppercase text-neutral-600">Meta Description *</label>
            <span className={`text-xs ${seoDesc.length > 160 ? "text-red-500" : seoDesc.length > 145 ? "text-amber-500" : "text-neutral-400"}`}>
              {seoDesc.length}/160
            </span>
          </div>
          <textarea
            name="seo_description"
            maxLength={160}
            rows={2}
            value={seoDesc}
            onChange={(e) => setSeoDesc(e.target.value)}
            className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 bg-white resize-none"
          />
          <p className="text-xs text-neutral-400 mt-1">Incluye la keyword y llamada a la acción. Ideal entre 140-160 caracteres.</p>
        </div>

        <div>
          <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
            Keywords objetivo <span className="text-neutral-400 normal-case">(separadas por coma)</span>
          </label>
          <input
            name="keywords"
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 bg-white"
            placeholder="keratina capilar, alisado brasileño, tratamiento pelo liso"
          />
        </div>
      </div>

      {/* ═══ REDES SOCIALES ═══ */}
      <div className="border border-neutral-200">
        <button
          type="button"
          onClick={() => {
            if (!rrssOpen && !socialFacebook) generarRRSS();
            else setRrssOpen((o) => !o);
          }}
          className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-neutral-50 transition-colors"
        >
          <span className="flex items-center gap-2 text-xs tracking-widest uppercase text-neutral-600 font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
            Contenido para Redes Sociales
            {socialFacebook && <span className="ml-2 text-green-600 normal-case font-normal">✓ generado</span>}
          </span>
          <div className="flex items-center gap-3">
            {(titulo || contenidoHtml) && !socialFacebook && (
              <span className="text-xs text-[#C9A84C]">Clic para generar automáticamente</span>
            )}
            <span className="text-neutral-400">{rrssOpen ? "▲" : "▼"}</span>
          </div>
        </button>

        {rrssOpen && (
          <div className="border-t border-neutral-100 p-5 space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-neutral-500">
                Contenido generado y editable. Cópialo cuando vayas a publicar en cada red.
              </p>
              <button
                type="button"
                onClick={generarRRSS}
                className="text-xs px-3 py-1.5 border border-neutral-300 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 transition-colors tracking-wider uppercase"
              >
                Regenerar
              </button>
            </div>

            {/* Facebook */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-xs tracking-wider uppercase text-[#1877F2] font-medium">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Facebook
                </label>
                <button
                  type="button"
                  onClick={() => copiar("fb", socialFacebook)}
                  className={`text-xs px-3 py-1 transition-colors ${copiadoId === "fb" ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
                >
                  {copiadoId === "fb" ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
              <textarea
                name="social_facebook"
                rows={8}
                value={socialFacebook}
                onChange={(e) => setSocialFacebook(e.target.value)}
                className="w-full border border-blue-100 px-3 py-2.5 text-sm focus:outline-none focus:border-[#1877F2] transition-colors resize-y text-neutral-700 bg-blue-50/30"
              />
              <p className="text-xs text-neutral-400 mt-1">{socialFacebook.length} caracteres · Óptimo: hasta 480</p>
            </div>

            {/* Instagram */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-xs tracking-wider uppercase font-medium" style={{ color: "#E1306C" }}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                  </svg>
                  Instagram
                </label>
                <button
                  type="button"
                  onClick={() => copiar("ig", socialInstagram)}
                  className={`text-xs px-3 py-1 transition-colors ${copiadoId === "ig" ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
                >
                  {copiadoId === "ig" ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
              <textarea
                name="social_instagram"
                rows={10}
                value={socialInstagram}
                onChange={(e) => setSocialInstagram(e.target.value)}
                className="w-full border px-3 py-2.5 text-sm focus:outline-none transition-colors resize-y text-neutral-700"
                style={{ borderColor: "#E1306C33", backgroundColor: "#E1306C08", outlineColor: "#E1306C" }}
              />
              <p className="text-xs text-neutral-400 mt-1">{socialInstagram.length} caracteres · Óptimo: 125-150 chars visibles + hashtags</p>
            </div>

            {/* TikTok */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-xs tracking-wider uppercase text-neutral-900 font-medium">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
                  </svg>
                  TikTok <span className="text-neutral-400 normal-case font-normal ml-1">(guión para vídeo)</span>
                </label>
                <button
                  type="button"
                  onClick={() => copiar("tt", socialTiktok)}
                  className={`text-xs px-3 py-1 transition-colors ${copiadoId === "tt" ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
                >
                  {copiadoId === "tt" ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
              <textarea
                name="social_tiktok"
                rows={10}
                value={socialTiktok}
                onChange={(e) => setSocialTiktok(e.target.value)}
                className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors resize-y text-neutral-700 bg-neutral-50"
              />
              <p className="text-xs text-neutral-400 mt-1">Guión editable — adapta el texto según el vídeo que grabes</p>
            </div>
          </div>
        )}
      </div>

      {/* Autor */}
      <div>
        <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">Autor</label>
        <input
          name="autor"
          type="text"
          defaultValue={post?.autor ?? "Esencia de Belleza"}
          className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900"
        />
      </div>

      {/* Flags */}
      <div className="flex items-center gap-8">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input name="publicado" type="checkbox" defaultChecked={post?.publicado ?? false} className="w-4 h-4 accent-neutral-900" />
          <span className="text-sm text-neutral-700">Publicado</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input name="destacado" type="checkbox" defaultChecked={post?.destacado ?? false} className="w-4 h-4 accent-neutral-900" />
          <span className="text-sm text-neutral-700">Destacado en home</span>
        </label>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-4 pt-4 border-t border-neutral-100">
        <SubmitButton isEdit={isEdit} />
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="px-6 py-3 border border-neutral-300 text-neutral-700 text-xs tracking-widest uppercase hover:border-neutral-900 hover:text-neutral-900 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Previsualizar
        </button>
        <a href="/admin/blog" className="text-xs tracking-widest uppercase text-neutral-400 hover:text-neutral-700">
          Cancelar
        </a>
      </div>

      {/* Modal de previsualización */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto p-4">
          <div className="relative bg-white w-full max-w-3xl my-8 shadow-2xl">
            {/* Header del modal */}
            <div className="sticky top-0 bg-white border-b border-neutral-100 px-6 py-4 flex items-center justify-between z-10">
              <span className="text-xs tracking-widest uppercase text-neutral-500">
                Previsualización del post
              </span>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Contenido simulado del post */}
            <div className="px-8 py-10">
              {/* Fecha y autor */}
              <p className="text-xs tracking-widest uppercase text-neutral-400 mb-4">
                {new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                {" · Esencia de Belleza"}
              </p>

              {/* Título */}
              <h1
                className="text-3xl font-light text-neutral-900 leading-tight mb-5"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {titulo || <span className="text-neutral-300">Sin título</span>}
              </h1>

              {/* Resumen */}
              {resumen && (
                <p className="text-base text-neutral-500 leading-relaxed border-l-2 border-[#C9A84C] pl-4 mb-8">
                  {resumen}
                </p>
              )}

              {/* Imagen */}
              {imagenUrl && (
                <div className="mb-8 aspect-video overflow-hidden bg-neutral-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagenUrl} alt={titulo} className="w-full h-full object-cover" />
                </div>
              )}

              {/* Contenido */}
              {contenidoHtml ? (
                <div
                  className="prose prose-neutral max-w-none
                    prose-headings:font-light prose-headings:text-neutral-900
                    prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-3
                    prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-2
                    prose-p:text-neutral-600 prose-p:leading-relaxed
                    prose-a:text-[#C9A84C] prose-a:no-underline
                    prose-strong:text-neutral-800
                    prose-table:text-sm"
                  dangerouslySetInnerHTML={{ __html: contenidoHtml }}
                />
              ) : (
                <p className="text-neutral-300 italic">Sin contenido todavía.</p>
              )}

              {/* SEO info */}
              <div className="mt-10 pt-6 border-t border-neutral-100 space-y-2 bg-neutral-50 -mx-8 px-8 py-5">
                <p className="text-xs tracking-widest uppercase text-neutral-400 mb-3">SEO (como aparece en Google)</p>
                <p className="text-blue-700 text-sm font-medium">{seoTitle || titulo}</p>
                <p className="text-green-700 text-xs">esenciadebelleza.es/blog/{slug || "slug-del-post"}</p>
                <p className="text-neutral-500 text-xs leading-relaxed">{seoDesc || resumen}</p>
                {keywords && (
                  <p className="text-xs text-neutral-400 mt-2">
                    <span className="font-medium">Keywords:</span> {keywords}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-8 py-3 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 disabled:opacity-50 transition-colors"
    >
      {pending ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear post"}
    </button>
  );
}
