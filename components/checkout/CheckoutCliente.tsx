"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCarrito } from "@/context/CarritoContext";
import { iniciarPagoCeca } from "@/actions/checkout";
import { calcularGastoEnvio, getZonaEnvio } from "@/lib/envio";

type Paso = "direccion" | "pago";

interface DatosEnvio {
  email:         string;
  nombre:        string;
  apellidos:     string;
  telefono:      string;
  direccion:     string;
  ciudad:        string;
  provincia:     string;
  codigo_postal: string;
  notas:         string;
}

// Provincias donde SÍ enviamos (sin Canarias, Ceuta ni Melilla)
const PROVINCIAS = [
  "Álava","Albacete","Alicante","Almería","Asturias","Ávila","Badajoz","Baleares",
  "Barcelona","Burgos","Cáceres","Cádiz","Cantabria","Castellón","Ciudad Real",
  "Córdoba","Cuenca","Girona","Granada","Guadalajara","Guipúzcoa","Huelva","Huesca",
  "Jaén","La Coruña","La Rioja","León","Lleida","Lugo","Madrid","Málaga",
  "Murcia","Navarra","Ourense","Palencia","Pontevedra","Salamanca",
  "Segovia","Sevilla","Soria","Tarragona","Teruel","Toledo","Valencia","Valladolid",
  "Vizcaya","Zamora","Zaragoza",
];

export function CheckoutCliente({
  emailInicial,
}: {
  emailInicial?: string;
}) {
  const { lineas, totalPrecio } = useCarrito();
  const [paso, setPaso]               = useState<Paso>("direccion");
  const [cecaCampos, setCecaCampos]   = useState<Record<string, string> | null>(null);
  const [cecaUrl, setCecaUrl]         = useState<string>("");
  const [gastoEnvioConf, setGastoEnvioConf] = useState(0);
  const [cargando, setCargando]       = useState(false);
  const [cargandoStripe, setCargandoStripe] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const formCecaRef = useRef<HTMLFormElement>(null);

  const [datos, setDatos] = useState<DatosEnvio>({
    email:         emailInicial ?? "",
    nombre:        "",
    apellidos:     "",
    telefono:      "",
    direccion:     "",
    ciudad:        "",
    provincia:     "Madrid",
    codigo_postal: "",
    notas:         "",
  });

  const zona        = getZonaEnvio(datos.provincia);
  const gastoEnvio   = zona === "no_disponible" ? 0 : calcularGastoEnvio(totalPrecio, datos.provincia);
  const totalFinal   = totalPrecio + gastoEnvio;

  const infoEnvio = (() => {
    if (zona === "baleares") return "Envío a Baleares: 12,00 €";
    if (zona === "valencia") return totalPrecio >= 35 ? "Envío gratis (pedido ≥ 35 €)" : "Envío: 5,00 € (gratis desde 35 €)";
    return totalPrecio >= 40 ? "Envío gratis (pedido ≥ 40 €)" : "Envío: 5,00 € (gratis desde 40 €)";
  })();

  function cambiar(campo: keyof DatosEnvio, valor: string) {
    setDatos((d) => ({ ...d, [campo]: valor }));
  }

  async function irAPaso2(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);

    const { gatewayUrl, campos, gastoEnvio: ge, error: err } =
      await iniciarPagoCeca(lineas, datos);

    if (err || !campos || !gatewayUrl) {
      setError(err ?? "Error al preparar el pago");
      setCargando(false);
      return;
    }

    setCecaCampos(campos);
    setCecaUrl(gatewayUrl);
    setGastoEnvioConf(ge);
    setPaso("pago");
    setCargando(false);
  }

  function pagarConTarjeta() {
    if (formCecaRef.current) formCecaRef.current.submit();
  }

  async function pagarConStripe() {
    setCargandoStripe(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineas, datosEnvio: datos }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setError(json.error ?? "Error al conectar con Stripe");
        setCargandoStripe(false);
        return;
      }
      // Redirigir: window.location.assign es más compatible en móvil
      window.location.assign(json.url);
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
      setCargandoStripe(false);
    }
  }

  if (!lineas.length) {
    return (
      <div className="text-center py-20">
        <p className="text-neutral-500 mb-4">Tu carrito está vacío</p>
        <Link
          href="/productos/peluqueria"
          className="text-xs tracking-widest uppercase border border-neutral-900 px-6 py-3 hover:bg-neutral-900 hover:text-white transition-colors"
        >
          Ver productos
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
      {/* ── Columna izquierda — Formulario ─────────────────────────────── */}
      <div className="lg:col-span-3">
        {/* Pasos */}
        <div className="flex items-center gap-3 mb-8 text-xs tracking-widest uppercase">
          <span className={paso === "direccion" ? "text-neutral-900 font-medium" : "text-neutral-400"}>
            1. Dirección
          </span>
          <span className="text-neutral-300">›</span>
          <span className={paso === "pago" ? "text-neutral-900 font-medium" : "text-neutral-400"}>
            2. Pago
          </span>
        </div>

        {/* PASO 1 — Dirección de envío */}
        {paso === "direccion" && (
          <form onSubmit={irAPaso2} className="space-y-4">
            <h2
              className="text-xl font-light text-neutral-900 mb-6"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Datos de envío
            </h2>

            {/* Email */}
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={datos.email}
                onChange={(e) => cambiar("email", e.target.value)}
                placeholder="tu@email.com"
                className="w-full border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>

            {/* Nombre y apellidos */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  value={datos.nombre}
                  onChange={(e) => cambiar("nombre", e.target.value)}
                  className="w-full border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                  Apellidos
                </label>
                <input
                  type="text"
                  required
                  value={datos.apellidos}
                  onChange={(e) => cambiar("apellidos", e.target.value)}
                  className="w-full border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
                />
              </div>
            </div>

            {/* Dirección */}
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                Dirección
              </label>
              <input
                type="text"
                required
                value={datos.direccion}
                onChange={(e) => cambiar("direccion", e.target.value)}
                placeholder="Calle, número, piso..."
                className="w-full border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>

            {/* Ciudad, Código postal */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                  Ciudad
                </label>
                <input
                  type="text"
                  required
                  value={datos.ciudad}
                  onChange={(e) => cambiar("ciudad", e.target.value)}
                  className="w-full border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                  Código postal
                </label>
                <input
                  type="text"
                  required
                  pattern="[0-9]{5}"
                  maxLength={5}
                  value={datos.codigo_postal}
                  onChange={(e) => cambiar("codigo_postal", e.target.value)}
                  placeholder="28001"
                  className="w-full border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
                />
              </div>
            </div>

            {/* Provincia */}
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                Provincia
              </label>
              <select
                value={datos.provincia}
                onChange={(e) => cambiar("provincia", e.target.value)}
                className="w-full border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 transition-colors bg-white"
              >
                {PROVINCIAS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              {/* Info dinámica de gastos de envío según provincia */}
              <p className="mt-1.5 text-xs text-neutral-500">{infoEnvio}</p>
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                Teléfono
              </label>
              <input
                type="tel"
                required
                value={datos.telefono}
                onChange={(e) => cambiar("telefono", e.target.value)}
                placeholder="+34 600 000 000"
                className="w-full border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>

            {/* Notas */}
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                Notas del pedido <span className="normal-case text-neutral-400">(opcional)</span>
              </label>
              <textarea
                rows={2}
                value={datos.notas}
                onChange={(e) => cambiar("notas", e.target.value)}
                placeholder="Instrucciones especiales de entrega..."
                className="w-full border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 transition-colors resize-none"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="w-full py-4 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 disabled:opacity-50 transition-colors"
            >
              {cargando ? "Preparando pago..." : "Continuar al pago →"}
            </button>
          </form>
        )}

        {/* PASO 2 — Confirmar y pagar con Cecabank */}
        {paso === "pago" && cecaCampos && (
          <div>
            <button onClick={() => setPaso("direccion")}
              className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors mb-6 block"
            >
              ← Modificar dirección
            </button>

            {/* Resumen dirección */}
            <div className="bg-neutral-50 border border-neutral-100 p-4 mb-6 text-sm text-neutral-600">
              <p className="font-medium text-neutral-900">{datos.nombre} {datos.apellidos}</p>
              <p>{datos.direccion}</p>
              <p>{datos.codigo_postal} {datos.ciudad}, {datos.provincia}</p>
              <p>{datos.email} · {datos.telefono}</p>
            </div>

            <h2
              className="text-xl font-light text-neutral-900 mb-4"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Elige tu método de pago
            </h2>

            {/* ── Stripe — pago principal ── */}
            <button
              onClick={pagarConStripe}
              disabled={cargandoStripe}
              className="w-full py-4 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-3 mb-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
              {cargandoStripe
                ? "Redirigiendo…"
                : `Pagar ${(totalPrecio + gastoEnvioConf).toLocaleString("es-ES", { style: "currency", currency: "EUR" })} con tarjeta`}
            </button>

            <p className="text-xs text-neutral-400 text-center mb-5 flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Pago seguro Visa / Mastercard · Cifrado SSL
            </p>

            {/* Formulario oculto que se envía a Cecabank (oculto, pendiente de resolver) */}
            <form ref={formCecaRef} action={cecaUrl} method="POST" className="hidden">
              {Object.entries(cecaCampos).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
            </form>
          </div>
        )}
      </div>

      {/* ── Columna derecha — Resumen pedido ───────────────────────────── */}
      <div className="lg:col-span-2">
        <div className="bg-neutral-50 border border-neutral-100 p-6 sticky top-24">
          <h2 className="text-xs tracking-widest uppercase text-neutral-500 mb-5">
            Resumen del pedido
          </h2>

          <ul className="divide-y divide-neutral-100 mb-5">
            {lineas.map((l) => (
              <li key={l.variacion_id} className="py-3 flex gap-3">
                {/* Imagen */}
                <div className="relative w-14 h-14 bg-white border border-neutral-100 shrink-0">
                  {l.imagen_url ? (
                    <Image src={l.imagen_url} alt={l.nombre} fill sizes="56px" className="object-contain p-1" />
                  ) : (
                    <div className="w-full h-full bg-neutral-100" />
                  )}
                  {/* Badge cantidad */}
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-neutral-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                    {l.cantidad}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-900 line-clamp-2 leading-snug">{l.nombre}</p>
                  {l.nombre_variacion && l.nombre_variacion !== "Unidad" && (
                    <p className="text-xs text-neutral-400">{l.nombre_variacion}</p>
                  )}
                </div>

                <span className="text-sm font-medium tabular-nums shrink-0">
                  {(l.precio * l.cantidad).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                </span>
              </li>
            ))}
          </ul>

          {/* Totales */}
          <div className="space-y-2 pt-4 border-t border-neutral-200 text-sm">
            <div className="flex justify-between text-neutral-600">
              <span>Subtotal</span>
              <span className="tabular-nums">
                {totalPrecio.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
              </span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Envío</span>
              <span className="tabular-nums">
                {gastoEnvio === 0
                  ? <span className="text-green-600">Gratis</span>
                  : gastoEnvio.toLocaleString("es-ES", { style: "currency", currency: "EUR" })
                }
              </span>
            </div>
            {gastoEnvio > 0 && (
              <p className="text-xs text-neutral-400">
                {infoEnvio}
              </p>
            )}
            <div className="flex justify-between font-medium text-neutral-900 pt-2 border-t border-neutral-200 text-base">
              <span>Total</span>
              <span className="tabular-nums">
                {totalFinal.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
              </span>
            </div>
            <p className="text-xs text-neutral-400">IVA incluido</p>
          </div>
        </div>
      </div>
    </div>
  );
}
