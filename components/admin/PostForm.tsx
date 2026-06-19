"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useRef, useState, useCallback } from "react";
import { crearPost, actualizarPost } from "@/actions/blog";
import { subirImagenBlog } from "@/actions/blog-upload";

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
  publicado?: boolean;
  destacado?: boolean;
  autor?: string;
}

interface EnlaceProducto {
  id: string;
  nombre: string;
  urlActual: string;
  urlCorrecta: string;
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
    if (data.contenido_html)  setContenidoHtml(data.contenido_html);
    if (data.seo_title)       setSeoTitle(data.seo_title.slice(0, 60));
    if (data.seo_description) setSeoDesc(data.seo_description.slice(0, 160));
    if (data.keywords)        setKeywords(data.keywords);

    const slugBase = data.slug || data.titulo || "";
    setSlug(slugify(slugBase));

    const html = data.contenido_html ?? "";
    const detectados = detectarEnlaces(html);
    setEnlaces(
      detectados.map((e, i) => ({
        ...e,
        id: `link-${i}`,
        urlCorrecta: e.urlActual,
      }))
    );
    setEnlacesAplicados(false);
    setImportOpen(false);
  }, [jsonInput]);

  // ── Aplicar URLs ───────────────────────────────────────────────────────────
  const aplicarUrls = useCallback(() => {
    setContenidoHtml((prev) => aplicarEnlaces(prev, enlaces));
    setEnlacesAplicados(true);
  }, [enlaces]);

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
              <div className="space-y-3">
                {enlaces.map((enlace, idx) => (
                  <div key={enlace.id} className="bg-white border border-blue-100 p-4 space-y-2 rounded-sm">
                    <p className="text-xs font-medium text-neutral-800">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs mr-2">
                        {idx + 1}
                      </span>
                      {enlace.nombre}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-400 shrink-0 w-28">URL del producto:</span>
                      <input
                        type="text"
                        value={enlace.urlCorrecta}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEnlaces((prev) =>
                            prev.map((l) => l.id === enlace.id ? { ...l, urlCorrecta: val } : l)
                          );
                        }}
                        className="flex-1 border border-neutral-200 px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-400 transition-colors"
                        placeholder="/productos/peluqueria/tratamientos/nombre-producto"
                      />
                    </div>
                    {enlace.urlActual && enlace.urlActual !== enlace.urlCorrecta && (
                      <p className="text-xs text-neutral-400 pl-28 -mt-1">
                        Gemini sugirió: <code className="text-neutral-500 bg-neutral-50 px-1">{enlace.urlActual}</code>
                        <button
                          type="button"
                          onClick={() => setEnlaces((prev) =>
                            prev.map((l) => l.id === enlace.id ? { ...l, urlCorrecta: enlace.urlActual } : l)
                          )}
                          className="ml-2 text-blue-500 underline hover:text-blue-700"
                        >
                          usar esta URL
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
            Alt text <span className="text-neutral-400 normal-case">(describe la imagen para Google Images)</span>
          </label>
          <input
            name="imagen_alt"
            type="text"
            defaultValue={post?.imagen_alt ?? ""}
            className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 bg-white"
            placeholder="Mujer aplicando keratina en peluquería profesional"
          />
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
