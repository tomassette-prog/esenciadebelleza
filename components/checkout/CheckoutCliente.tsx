"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCarrito } from "@/context/CarritoContext";
import { calcularGastoEnvio, getZonaEnvio, getSuplementoContrareembolso } from "@/lib/envio";
import { crearPedidoContrarembolso } from "@/actions/checkout";

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
  const [cargandoCR, setCargandoCR]         = useState(false);
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
    if (zona === "baleares") return "Envío a Baleares: 7,00 €";
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

  async function pagarContrarembolso() {
    setCargandoCR(true);
    setError(null);
    try {
      const result = await crearPedidoContrarembolso(lineas, packs, datos);
      if (result.ok) {
        window.location.href = `/checkout/confirmacion?metodo=contrarembolso&pedido=${result.pedidoId}&resultado=ok`;
      } else {
        setError(result.error ?? "Error al crear el pedido");
        setCargandoCR(false);
      }
    } catch {
      setError("Error al procesar el pedido");
      setCargandoCR(false);
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

            {/* Logos de métodos de pago */}
            <div className="flex items-end justify-center gap-5 mb-2 py-3">
              {/* Visa */}
              <div className="flex flex-col items-center gap-1">
                <svg className="h-6 w-auto" viewBox="0 0 780 500" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M293.2 348.7l33.4-195.8h53.3l-33.3 195.8h-53.4zM530.9 157.7c-10.6-4-27.2-8.3-47.8-8.3-52.7 0-89.9 27.8-90.2 67.8-.3 29.7 26.7 46.2 47 56 20.8 10 27.8 16.4 27.7 25.3-.1 13.7-16.6 20-32 20-21.4 0-32.7-3-50.4-10.2l-6.9-3.1-7.5 43.8c12.5 5.5 35.6 10.2 59.6 10.5 56.1 0 92.6-27.5 93.1-70.2.2-23.3-14.5-41-46.4-55.8-19.3-9.3-31.2-15.5-31.1-25 0-8.4 9.7-17.5 30.6-17.5 17.5-.3 30.1 3.5 39.9 7.5l4.8 2.3 7.1-42.2zM675.5 152.9h-41.3c-12.8 0-22.4 3.5-28 16.3L467.8 348.7h59.4l16.7-44.2h72.6l9.8 44.2h52.2l-53-195.8zm-67 126.5l30.7-79.1 17.4 79.1h-48.1z" fill="#1A1F71"/>
                  <path d="M216.5 152.9l-52.4 134-5.6-27.2c-9.7-31.3-40-65.3-73.8-82.3l47.7 170.3h59.4l89.2-194.8h-64.8z" fill="#1A1F71"/>
                  <path d="M134.2 152.9H46.1l-.7 3.8c66.6 16.3 110.4 55.6 128.6 103l-18.5-89c-3.2-12.3-12.6-16.1-21.3-17.8z" fill="#F7B600"/>
                </svg>
                <span className="text-[9px] text-neutral-400">Visa</span>
              </div>
              {/* Mastercard */}
              <div className="flex flex-col items-center gap-1">
                <svg className="h-6 w-auto" viewBox="0 0 780 500" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="312" cy="250" r="140" fill="#EB001B"/>
                  <circle cx="468" cy="250" r="140" fill="#F79E1B"/>
                  <path d="M390 143.6c31.3 25.2 51 63.6 51 106.4s-19.7 81.2-51 106.4c-31.3-25.2-51-63.6-51-106.4s19.7-81.2 51-106.4z" fill="#FF5F00"/>
                </svg>
                <span className="text-[9px] text-neutral-400">Mastercard</span>
              </div>
              {/* Apple Pay */}
              <div className="flex flex-col items-center gap-1">
                <svg className="h-6 w-auto" viewBox="0 0 780 500" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M232.7 130.1c-12.7 15-33.5 26.6-53.7 25.3-2.7-21.5 8-44.1 19.8-58.2 12.6-15 34.8-26.3 53.3-27.2 2.1 22.3-6.5 44.5-19.4 60.1zM265.8 194.5c-29.2-1.7-54.4 16.7-68.3 16.7-14.1 0-35.4-15.9-58.4-15.5-30.1.4-57.9 17.5-73.5 44.5-31.4 53.8-8.1 133.5 22.2 177.4 14.9 21.6 32.6 45.9 55.8 45.1 22-.7 30.5-14.3 57.2-14.3 26.7 0 34.3 14.3 57.6 13.9 24.2-.4 39.3-21.9 54-43.6 17-25 23.9-49.3 24.3-50.6-.5-.5-46.8-18-47.3-71.2-.5-44.4 36.3-65.7 37.8-66.8-20.7-30.5-52.8-34-64.1-35.4l-22.1-1z" fill="#000"/>
                  <path d="M218.5 84.6c12.3-14.8 20.5-35.4 18.3-56-17.7 1-38.6 11.9-51 26.5-11.2 13.2-21.1 34.1-18.5 54.1 19.5 1.5 39.3-10 51.2-24.6z" fill="#000"/>
                </svg>
                <span className="text-[9px] text-neutral-400">Apple Pay</span>
              </div>
              {/* Google Pay */}
              <div className="flex flex-col items-center gap-1">
                <svg className="h-7 w-auto" viewBox="0 0 780 500" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M372.7 247.2c0-13.4-1.2-26.2-3.4-38.4h-105v72.6h59.9c-2.6 14-10.4 25.9-22.1 33.8v28h35.8c20.9-19.3 33-47.7 33-96h1.8z" fill="#4285F4"/>
                  <path d="M372.7 315.2c-35.8 0-65.9-23.9-76.6-56.2h-35.8v28c21.1 41.8 63.9 69.8 112.4 69.8 32.1 0 59.1-10.6 78.9-28.9l-35.8-28c-10.6 7.1-24.2 11.3-43.1 15.3z" fill="#34A853"/>
                  <path d="M296.1 260.2c-5-14.8-5-30.6 0-45.4v-28h-35.8c-14.6 29-14.6 63.4 0 92.4l35.8-19z" fill="#FBBC05"/>
                  <path d="M296.1 214.8c18.8-29.3 56.7-39.6 86.6-24.2l28-28c-30.9-22.8-71.2-30.9-114.6-7.4l35.8 19z" fill="#EA4335"/>
                </svg>
                <span className="text-[9px] text-neutral-400">Google Pay</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1.5 mb-6">
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-[11px] text-neutral-400">Pago seguro con cifrado SSL · 100% protegido</span>
            </div>

            {/* ── Contra reembolso ── */}
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <button
                onClick={pagarContrarembolso}
                disabled={cargandoCR}
                className="group w-full py-4 px-6 bg-white border-2 border-neutral-300 text-neutral-900 text-sm tracking-wide hover:border-neutral-900 disabled:opacity-50 transition-all flex items-center justify-between rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                  </svg>
                  <span className="font-medium">
                    {cargandoCR ? "Procesando…" : "Contra reembolso"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">+{getSuplementoContrareembolso(totalPrecio).toFixed(2)} € suplemento</span>
                  <span className="text-lg font-light">
                    {(totalPrecio + gastoEnvioConf + getSuplementoContrareembolso(totalPrecio) || totalPrecio + gastoEnvio + getSuplementoContrareembolso(totalPrecio)).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                  </span>
                  <svg className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
              <p className="text-[11px] text-neutral-400 mt-2 text-center">
                Pagas en efectivo al repartidor cuando recibas tu pedido
              </p>
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
