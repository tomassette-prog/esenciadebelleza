"use client";

import { useState, useTransition, useRef } from "react";
import { crearMarca, actualizarMarca, subirLogoMarca } from "@/actions/marcas";

interface Marca {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
  activa: boolean;
}

export function MarcasAdmin({ marcas: inicial }: { marcas: Marca[] }) {
  const [marcas, setMarcas] = useState<Marca[]>(inicial);
  const [isPending, startTransition] = useTransition();
  const [creando, setCreando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoLogo, setNuevoLogo] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editLogo, setEditLogo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function handleCrear() {
    if (!nuevoNombre.trim()) return;
    setMsg(null);
    startTransition(async () => {
      const res = await crearMarca({ nombre: nuevoNombre, logo_url: nuevoLogo || null });
      if (res.error) { setMsg("Error: " + res.error); return; }
      setMarcas(prev => [...prev, {
        id: res.id!, nombre: nuevoNombre.trim(),
        slug: nuevoNombre.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        logo_url: nuevoLogo || null, activa: true
      }].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNuevoNombre(""); setNuevoLogo(""); setCreando(false);
      setMsg("✓ Marca creada");
    });
  }

  function handleGuardar(id: string) {
    startTransition(async () => {
      const res = await actualizarMarca(id, { nombre: editNombre, logo_url: editLogo || null });
      if (res.error) { setMsg("Error: " + res.error); return; }
      setMarcas(prev => prev.map(m => m.id === id
        ? { ...m, nombre: editNombre, logo_url: editLogo || null }
        : m
      ));
      setEditando(null);
      setMsg("✓ Guardado");
    });
  }

  function handleToggle(id: string, activa: boolean) {
    startTransition(async () => {
      await actualizarMarca(id, { activa: !activa });
      setMarcas(prev => prev.map(m => m.id === id ? { ...m, activa: !activa } : m));
    });
  }

  function handleSubirLogo(id: string, slug: string, file: File) {
    setMsg(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await subirLogoMarca(id, slug, fd);
      if (res.error) { setMsg("Error: " + res.error); return; }
      setMarcas(prev => prev.map(m => m.id === id ? { ...m, logo_url: res.url! } : m));
      setMsg("✓ Logo subido");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
            Marcas
          </h1>
          <p className="text-sm text-neutral-400 mt-1">{marcas.length} marcas · gestiona nombres y logos</p>
        </div>
        <button
          onClick={() => setCreando(true)}
          className="px-5 py-2 border border-neutral-300 text-xs tracking-widest uppercase hover:border-neutral-700 transition-colors"
        >
          + Nueva marca
        </button>
      </div>

      {msg && (
        <div className={`text-sm px-3 py-2 border ${msg.startsWith("Error") ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
          {msg}
        </div>
      )}

      {/* Formulario nueva marca */}
      {creando && (
        <div className="border border-neutral-200 p-4 space-y-3 bg-neutral-50">
          <p className="text-sm font-medium text-neutral-700">Nueva marca</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-500 block mb-1">Nombre *</label>
              <input
                autoFocus
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                placeholder="ej: The Fruit Company"
                className="w-full border border-neutral-300 px-3 py-2 text-sm"
                onKeyDown={e => e.key === "Enter" && handleCrear()}
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">URL del logo (opcional)</label>
              <input
                value={nuevoLogo}
                onChange={e => setNuevoLogo(e.target.value)}
                placeholder="https://..."
                className="w-full border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCrear}
              disabled={isPending || !nuevoNombre.trim()}
              className="px-4 py-2 bg-neutral-900 text-white text-xs tracking-widest uppercase disabled:opacity-40"
            >
              {isPending ? "Creando…" : "Crear"}
            </button>
            <button
              onClick={() => { setCreando(false); setNuevoNombre(""); setNuevoLogo(""); }}
              className="px-4 py-2 border border-neutral-300 text-xs uppercase"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="px-4 py-2 text-left text-xs uppercase tracking-widest text-neutral-500 w-16">Logo</th>
              <th className="px-4 py-2 text-left text-xs uppercase tracking-widest text-neutral-500">Nombre</th>
              <th className="px-4 py-2 text-left text-xs uppercase tracking-widest text-neutral-500 hidden md:table-cell">Slug</th>
              <th className="px-4 py-2 text-center text-xs uppercase tracking-widest text-neutral-500">Visible</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {marcas.map(m => (
              <tr key={m.id} className="hover:bg-neutral-50">
                <td className="px-4 py-2">
                  <div className="w-12 h-8 flex items-center justify-center">
                    {m.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.logo_url} alt={m.nombre} className="max-h-8 max-w-12 object-contain" />
                    ) : (
                      <div className="w-10 h-7 bg-neutral-100 border border-dashed border-neutral-300 flex items-center justify-center text-[9px] text-neutral-400">
                        sin logo
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2">
                  {editando === m.id ? (
                    <input
                      value={editNombre}
                      onChange={e => setEditNombre(e.target.value)}
                      className="border border-neutral-300 px-2 py-1 text-sm w-full max-w-xs"
                    />
                  ) : (
                    <span className="text-neutral-800">{m.nombre}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-neutral-400 font-mono text-xs hidden md:table-cell">{m.slug}</td>
                <td className="px-4 py-2 text-center">
                  <button
                    onClick={() => handleToggle(m.id, m.activa)}
                    disabled={isPending}
                    className={`text-xs px-2 py-0.5 border ${m.activa ? "border-green-200 bg-green-50 text-green-700" : "border-neutral-200 bg-neutral-50 text-neutral-400"}`}
                  >
                    {m.activa ? "Sí" : "No"}
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  {editando === m.id ? (
                    <div className="flex items-center gap-2 justify-end">
                      <input
                        value={editLogo}
                        onChange={e => setEditLogo(e.target.value)}
                        placeholder="URL logo"
                        className="border border-neutral-300 px-2 py-1 text-xs w-48"
                      />
                      <button
                        onClick={() => handleGuardar(m.id)}
                        disabled={isPending}
                        className="text-xs px-3 py-1 bg-neutral-900 text-white disabled:opacity-40"
                      >
                        Guardar
                      </button>
                      <button onClick={() => setEditando(null)} className="text-xs text-neutral-400 hover:text-neutral-700">
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 justify-end">
                      {/* Subir logo desde archivo */}
                      <label className="text-xs text-neutral-400 hover:text-neutral-700 cursor-pointer" title="Subir logo desde archivo">
                        📁
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={el => { fileRefs.current[m.id] = el; }}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleSubirLogo(m.id, m.slug, file);
                          }}
                        />
                      </label>
                      <button
                        onClick={() => { setEditando(m.id); setEditNombre(m.nombre); setEditLogo(m.logo_url ?? ""); }}
                        className="text-xs text-neutral-500 hover:text-neutral-900 underline underline-offset-2"
                      >
                        Editar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
