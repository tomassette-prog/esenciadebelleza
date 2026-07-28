"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCarrito } from "@/context/CarritoContext";
import { calcularGastoEnvio, getZonaEnvio } from "@/lib/envio";
import PaypalSmartButtons from "@/components/checkout/PaypalSmartButtons";

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
  const { lineas, packs, totalPrecio } = useCarrito();
  const [paso, setPaso]               = useState<Paso>("direccion");
  const [gastoEnvioConf, setGastoEnvioConf] = useState(0);
  const [cargando, setCargando]       = useState(false);
  const [cargandoStripe, setCargandoStripe] = useState(false);
  const [error, setError]                 = useState<string | null>(null);

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

    // Solo validar dirección y calcular gasto de envío (sin crear pedido aún)
    const envioCalc = calcularGastoEnvio(totalPrecio, datos.provincia);
    if (envioCalc === -1) {
      setError("No realizamos envíos a esa provincia.");
      setCargando(false);
      return;
    }

    setGastoEnvioConf(envioCalc);
    setPaso("pago");
    setCargando(false);
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
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Error al conectar con Stripe");
        setCargandoStripe(false);
      }
    } catch {
      setError("Error al conectar con Stripe");
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

        {/* PASO 2 — Confirmar y pagar */}
        {paso === "pago" && (
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
              className="text-xl font-light text-neutral-900 mb-6"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Elige tu método de pago
            </h2>

            {/* ── Stripe — pago con tarjeta ── */}
            <button
              onClick={pagarConStripe}
              disabled={cargandoStripe}
              className="group w-full py-4 px-6 bg-neutral-900 text-white text-sm tracking-wide hover:bg-neutral-800 disabled:opacity-50 transition-all flex items-center justify-between rounded-lg mb-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
                <span className="font-medium">
                  {cargandoStripe
                    ? "Procesando…"
                    : "Pagar con tarjeta"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-light">
                  {(totalPrecio + gastoEnvioConf || totalPrecio + gastoEnvio).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                </span>
                <svg className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* Logos de tarjetas aceptadas */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 uppercase tracking-wider">
                <span>Aceptamos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded border border-blue-100">VISA</span>
                <span className="px-2 py-0.5 bg-red-50 text-red-700 text-[10px] font-semibold rounded border border-red-100">MC</span>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-800 text-[10px] font-semibold rounded border border-blue-100">AMEX</span>
              </div>
              <span className="text-[10px] text-neutral-300">·</span>
              <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Pago seguro SSL
              </div>
            </div>

            {/* ── Separador ── */}
            <div className="flex items-center gap-4 mb-5">
              <div className="flex-1 h-px bg-neutral-200"></div>
              <span className="text-[11px] text-neutral-400 uppercase tracking-widest">o</span>
              <div className="flex-1 h-px bg-neutral-200"></div>
            </div>

            {/* ── PayPal — alternativa de pago ── */}
            <div className="bg-white border border-neutral-200 rounded-lg p-4">
              <PaypalSmartButtons
                lineas={lineas}
                datosEnvio={datos}
                disabled={cargando}
              />
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">{error}</div>
            )}
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
