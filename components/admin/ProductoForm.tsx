"use client";

import { useFormState, useFormStatus } from "react-dom";
import { slugifyCategoria } from "@/lib/seo";
import { useState } from "react";
import type { Marca } from "@/types/producto";

interface Props {
  action: (prev: { error?: string } | null, formData: FormData) => Promise<{ error?: string }>;
  marcas: Marca[];
  categoriasExistentes: string[];
  defaultValues?: {
    nombre?: string;
    categoria?: string;
    subcategoria?: string;
    marca_id?: string;
    descripcion?: string;
    imagen_url?: string;
    seo_title?: string;
    seo_description?: string;
    destacado?: boolean;
    nuevo?: boolean;
    activo?: boolean;
    // Para variación única (solo en crear)
    sku?: string;
    nombre_variacion?: string;
    precio_b2c?: number;
    precio_b2b?: number;
    stock?: number;
  };
  modo: "crear" | "editar";
  productoId?: string;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary px-8 py-3 text-sm tracking-widest uppercase disabled:opacity-50"
    >
      {pending ? "Guardando..." : label}
    </button>
  );
}

export function ProductoForm({ action, marcas, categoriasExistentes, defaultValues = {}, modo, productoId }: Props) {
  const [state, formAction] = useFormState(action, null);
  const [nombre, setNombre] = useState(defaultValues.nombre ?? "");
  const [categoria, setCategoria] = useState(defaultValues.categoria ?? "");
  const [subcategoria, setSubcategoria] = useState(defaultValues.subcategoria ?? "");
  const [nuevaCategoria, setNuevaCategoria] = useState(false);
  const slugPreview = slugifyCategoria(categoria);
  const subcatPreview = subcategoria ? slugifyCategoria(subcategoria) : "general";
  const slugProducto = slugifyCategoria(nombre);

  return (
    <form action={formAction} className="space-y-8">
      {productoId && <input type="hidden" name="producto_id" value={productoId} />}

      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {state.error}
        </div>
      )}

      {/* ── Información básica ── */}
      <section className="bg-white border border-neutral-200 p-6 space-y-5">
        <h2 className="text-lg font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
          Información básica
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-1.5">
              Nombre del producto *
            </label>
            <input
              type="text"
              name="nombre"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="input-clean w-full"
              placeholder="Ej: Tinte Permanente Koleston"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-1.5">
              Marca
            </label>
            <select name="marca_id" defaultValue={defaultValues.marca_id ?? ""} className="input-clean w-full">
              <option value="">Sin marca</option>
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-1.5">
            Descripción
          </label>
          <textarea
            name="descripcion"
            rows={4}
            defaultValue={defaultValues.descripcion ?? ""}
            className="input-clean w-full resize-y"
            placeholder="Descripción detallada del producto..."
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-1.5">
            URL de imagen principal
          </label>
          <input
            type="url"
            name="imagen_url"
            defaultValue={defaultValues.imagen_url ?? ""}
            className="input-clean w-full font-mono text-sm"
            placeholder="https://..."
          />
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              name="destacado"
              defaultChecked={defaultValues.destacado ?? false}
              className="w-4 h-4 accent-neutral-900"
            />
            <span className="text-sm text-neutral-700">Destacado (aparece en home)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              name="nuevo"
              defaultChecked={defaultValues.nuevo ?? false}
              className="w-4 h-4 accent-neutral-900"
            />
            <span className="text-sm text-neutral-700">Marcar como Nuevo</span>
          </label>
          {modo === "editar" && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                name="activo"
                defaultChecked={defaultValues.activo ?? true}
                className="w-4 h-4 accent-neutral-900"
              />
              <span className="text-sm text-neutral-700">Activo (visible en tienda)</span>
            </label>
          )}
        </div>
      </section>

      {/* ── Categoría SEO ── */}
      <section className="bg-white border border-neutral-200 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
            Categoría (define la URL)
          </h2>
          <button
            type="button"
            onClick={() => setNuevaCategoria(!nuevaCategoria)}
            className="text-xs text-neutral-500 hover:text-neutral-800 underline underline-offset-2"
          >
            {nuevaCategoria ? "Usar categoría existente" : "Crear nueva categoría"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-1.5">
              Categoría *
            </label>
            {nuevaCategoria ? (
              <input
                type="text"
                name="categoria"
                required
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="input-clean w-full"
                placeholder="Ej: Peluquería"
              />
            ) : (
              <select
                name="categoria"
                required
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="input-clean w-full"
              >
                <option value="">Seleccionar categoría</option>
                {categoriasExistentes.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-1.5">
              Subcategoría
            </label>
            <input
              type="text"
              name="subcategoria"
              value={subcategoria}
              onChange={(e) => setSubcategoria(e.target.value)}
              className="input-clean w-full"
              placeholder="Ej: Tintes"
            />
          </div>
        </div>

        {/* Preview URL */}
        {(nombre || categoria) && (
          <div className="bg-neutral-50 border border-neutral-200 px-4 py-3 text-xs font-mono text-neutral-600">
            <span className="text-neutral-400">URL: </span>
            esenciadebelleza.es/productos/
            <span className="text-green-700 font-semibold">{slugPreview || "[categoria]"}</span>
            /{subcatPreview}/
            <span className="text-blue-700 font-semibold">{slugProducto || "[nombre-producto]"}</span>
          </div>
        )}
      </section>

      {/* ── SEO ── */}
      <section className="bg-white border border-neutral-200 p-6 space-y-5">
        <h2 className="text-lg font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
          SEO <span className="text-sm font-normal text-neutral-400">(opcional — se auto-genera si está vacío)</span>
        </h2>

        <div>
          <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-1.5">
            Título SEO <span className="normal-case text-neutral-400">(max 60 caracteres)</span>
          </label>
          <input
            type="text"
            name="seo_title"
            maxLength={60}
            defaultValue={defaultValues.seo_title ?? ""}
            className="input-clean w-full"
            placeholder={nombre ? `${nombre} | Esencia de Belleza` : ""}
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-1.5">
            Meta descripción <span className="normal-case text-neutral-400">(max 155 caracteres)</span>
          </label>
          <textarea
            name="seo_description"
            maxLength={155}
            rows={2}
            defaultValue={defaultValues.seo_description ?? ""}
            className="input-clean w-full resize-none"
            placeholder={nombre ? `Compra ${nombre} en Esencia de Belleza. Envío rápido en España.` : ""}
          />
        </div>
      </section>

      {/* ── Variación inicial (solo al crear) ── */}
      {modo === "crear" && (
        <section className="bg-white border border-neutral-200 p-6 space-y-5">
          <h2 className="text-lg font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
            Primera variación *
          </h2>
          <p className="text-xs text-neutral-400">
            Podrás añadir más variaciones (tallas, colores, etc.) después de crear el producto.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-1.5">SKU *</label>
              <input
                type="text"
                name="sku"
                required
                defaultValue={defaultValues.sku ?? ""}
                className="input-clean w-full font-mono"
                placeholder="REF-001"
              />
            </div>
            <div className="col-span-1 lg:col-span-1">
              <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-1.5">Nombre variación</label>
              <input
                type="text"
                name="nombre_variacion"
                defaultValue={defaultValues.nombre_variacion ?? "Único"}
                className="input-clean w-full"
                placeholder="Único / 100ml / Rubio..."
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-1.5">Precio B2C (€) *</label>
              <input
                type="number"
                name="precio_b2c"
                required
                step="0.01"
                min="0"
                defaultValue={defaultValues.precio_b2c ?? ""}
                className="input-clean w-full"
                placeholder="9.99"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-1.5">Stock</label>
              <input
                type="number"
                name="stock"
                min="0"
                defaultValue={defaultValues.stock ?? 0}
                className="input-clean w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-1.5">Precio B2B (€)</label>
              <input
                type="number"
                name="precio_b2b"
                step="0.01"
                min="0"
                defaultValue={defaultValues.precio_b2b ?? ""}
                className="input-clean w-full"
                placeholder="Opcional"
              />
            </div>
          </div>
        </section>
      )}

      <div className="flex items-center gap-4">
        <SubmitButton label={modo === "crear" ? "Crear producto" : "Guardar cambios"} />
      </div>
    </form>
  );
}
