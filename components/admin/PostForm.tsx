"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useRef, useState } from "react";
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

interface Props {
  post?: Post;
}

export default function PostForm({ post }: Props) {
  const isEdit = !!post?.id;
  const action = isEdit ? actualizarPost.bind(null, post!.id!) : crearPost;
  const [state, formAction] = useFormState(action, null);

  // Estado del upload de imagen
  const [imagenUrl, setImagenUrl]   = useState<string>(post?.imagen_url ?? "");
  const [uploadMsg, setUploadMsg]   = useState<string>("");
  const [uploading, setUploading]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);

  // Contadores SEO
  const [seoTitleLen, setSeoTitleLen]   = useState((post?.seo_title ?? "").length);
  const [seoDescLen, setSeoDescLen]     = useState((post?.seo_description ?? "").length);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setUploadMsg("Selecciona un archivo primero."); return; }

    setUploading(true);
    setUploadMsg("Subiendo...");

    const fd = new FormData();
    fd.append("imagen", file);
    fd.append("slug", slugRef.current?.value || "post");

    const res = await subirImagenBlog(fd);

    setUploading(false);
    if (res.error) {
      setUploadMsg("Error: " + res.error);
    } else {
      setImagenUrl(res.url!);
      setUploadMsg("✓ Imagen subida correctamente");
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm">
          {state.error}
        </div>
      )}

      {/* Título */}
      <div>
        <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
          Título *
        </label>
        <input
          name="titulo"
          type="text"
          required
          defaultValue={post?.titulo ?? ""}
          className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
          placeholder="Keratina vs alisado brasileño: ¿cuál elegir?"
        />
      </div>

      {/* Slug */}
      <div>
        <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
          Slug <span className="text-neutral-400 normal-case">(se genera automáticamente si lo dejas vacío)</span>
        </label>
        <input
          ref={slugRef}
          name="slug"
          type="text"
          defaultValue={post?.slug ?? ""}
          className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors font-mono text-neutral-500"
          placeholder="keratina-vs-alisado-brasileno-cual-elegir"
        />
      </div>

      {/* Resumen */}
      <div>
        <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
          Resumen <span className="text-neutral-400 normal-case">(vista previa en el listado)</span>
        </label>
        <textarea
          name="resumen"
          rows={2}
          defaultValue={post?.resumen ?? ""}
          className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors resize-none"
          placeholder="Breve descripción del artículo para el listado del blog..."
        />
      </div>

      {/* Contenido HTML */}
      <div>
        <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
          Contenido HTML *{" "}
          <span className="text-neutral-400 normal-case">
            (pega el campo <code className="bg-neutral-100 px-1">contenido_html</code> del JSON de Gemini)
          </span>
        </label>
        <textarea
          name="contenido_html"
          required
          rows={20}
          defaultValue={post?.contenido_html ?? ""}
          className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors resize-y font-mono text-xs text-neutral-600"
          placeholder="<h2>Título de sección</h2><p>Contenido del artículo...</p>"
        />
      </div>

      {/* ── Imagen destacada ── */}
      <div className="p-5 bg-neutral-50 border border-neutral-100 space-y-4">
        <p className="text-xs tracking-widest uppercase text-neutral-500">Imagen destacada</p>

        {/* Preview */}
        {imagenUrl && (
          <div className="relative w-full max-w-sm aspect-video bg-neutral-100 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagenUrl} alt="Preview" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Upload */}
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
          <p className={`text-xs ${uploadMsg.startsWith("✓") ? "text-green-700" : "text-red-600"}`}>
            {uploadMsg}
          </p>
        )}

        {/* URL resultante (oculta para el form, visible para editar manualmente) */}
        <div>
          <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
            URL imagen <span className="text-neutral-400 normal-case">(se rellena automáticamente al subir)</span>
          </label>
          <input
            name="imagen_url"
            type="url"
            value={imagenUrl}
            onChange={(e) => setImagenUrl(e.target.value)}
            className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors bg-white font-mono text-xs text-neutral-500"
            placeholder="https://..."
          />
        </div>

        {/* Alt text SEO */}
        <div>
          <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
            Alt text de imagen <span className="text-neutral-400 normal-case">(describe la imagen para Google Images y accesibilidad)</span>
          </label>
          <input
            name="imagen_alt"
            type="text"
            defaultValue={post?.imagen_alt ?? ""}
            className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors bg-white"
            placeholder="Mujer aplicando tratamiento de keratina en peluquería profesional"
          />
        </div>
      </div>

      {/* ── SEO ── */}
      <div className="p-5 bg-neutral-50 border border-neutral-100 space-y-4">
        <p className="text-xs tracking-widest uppercase text-neutral-500">SEO</p>

        {/* SEO Title */}
        <div>
          <div className="flex justify-between mb-1.5">
            <label className="text-xs tracking-wider uppercase text-neutral-600">
              SEO Title *
            </label>
            <span className={`text-xs ${seoTitleLen > 60 ? "text-red-500" : seoTitleLen > 50 ? "text-amber-500" : "text-neutral-400"}`}>
              {seoTitleLen}/60
            </span>
          </div>
          <input
            name="seo_title"
            type="text"
            maxLength={60}
            defaultValue={post?.seo_title ?? ""}
            onChange={(e) => setSeoTitleLen(e.target.value.length)}
            className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors bg-white"
            placeholder="Keratina vs alisado brasileño | Esencia de Belleza"
          />
          <p className="text-xs text-neutral-400 mt-1">
            Incluye la keyword principal. Entre 50-60 caracteres es ideal.
          </p>
        </div>

        {/* Meta Description */}
        <div>
          <div className="flex justify-between mb-1.5">
            <label className="text-xs tracking-wider uppercase text-neutral-600">
              Meta Description *
            </label>
            <span className={`text-xs ${seoDescLen > 160 ? "text-red-500" : seoDescLen > 145 ? "text-amber-500" : "text-neutral-400"}`}>
              {seoDescLen}/160
            </span>
          </div>
          <textarea
            name="seo_description"
            maxLength={160}
            rows={2}
            defaultValue={post?.seo_description ?? ""}
            onChange={(e) => setSeoDescLen(e.target.value.length)}
            className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors bg-white resize-none"
            placeholder="Descubre las diferencias entre keratina y alisado brasileño y elige el mejor tratamiento para tu cabello. ¡Envío rápido!"
          />
          <p className="text-xs text-neutral-400 mt-1">
            Incluye la keyword y una llamada a la acción. Entre 140-160 caracteres.
          </p>
        </div>

        {/* Keywords */}
        <div>
          <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
            Keywords objetivo <span className="text-neutral-400 normal-case">(separadas por coma)</span>
          </label>
          <input
            name="keywords"
            type="text"
            defaultValue={post?.keywords ?? ""}
            className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors bg-white"
            placeholder="keratina capilar, alisado brasileño, tratamiento pelo liso, diferencia keratina alisado"
          />
          <p className="text-xs text-neutral-400 mt-1">
            Palabras clave a posicionar — asegúrate de que aparecen en el contenido y en el título. Google no usa meta keywords pero te sirve de guía interna.
          </p>
        </div>
      </div>

      {/* Autor */}
      <div>
        <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
          Autor
        </label>
        <input
          name="autor"
          type="text"
          defaultValue={post?.autor ?? "Esencia de Belleza"}
          className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
        />
      </div>

      {/* Flags */}
      <div className="flex items-center gap-8">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            name="publicado"
            type="checkbox"
            defaultChecked={post?.publicado ?? false}
            className="w-4 h-4 accent-neutral-900"
          />
          <span className="text-sm text-neutral-700">Publicado</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            name="destacado"
            type="checkbox"
            defaultChecked={post?.destacado ?? false}
            className="w-4 h-4 accent-neutral-900"
          />
          <span className="text-sm text-neutral-700">Destacado en home</span>
        </label>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-4 pt-2">
        <SubmitButton isEdit={isEdit} />
        <a
          href="/admin/blog"
          className="text-xs tracking-widest uppercase text-neutral-400 hover:text-neutral-700 transition-colors"
        >
          Cancelar
        </a>
      </div>
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
