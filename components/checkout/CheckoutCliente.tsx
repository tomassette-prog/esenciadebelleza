"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import Image from "next/image";
import Link from "next/link";
import { useCarrito } from "@/context/CarritoContext";
import { crearPaymentIntent } from "@/actions/checkout";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

// Carga Stripe solo una vez fuera del render
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

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

const PROVINCIAS = [
  "Álava","Albacete","Alicante","Almería","Asturias","Ávila","Badajoz","Baleares",
  "Barcelona","Burgos","Cáceres","Cádiz","Cantabria","Castellón","Ciudad Real",
  "Córdoba","Cuenca","Girona","Granada","Guadalajara","Guipúzcoa","Huelva","Huesca",
  "Jaén","La Coruña","La Rioja","Las Palmas","León","Lleida","Lugo","Madrid","Málaga",
  "Murcia","Navarra","Ourense","Palencia","Pontevedra","Salamanca","Santa Cruz de Tenerife",
  "Segovia","Sevilla","Soria","Tarragona","Teruel","Toledo","Valencia","Valladolid",
  "Vizcaya","Zamora","Zaragoza","Ceuta","Melilla",
];

export function CheckoutCliente({
  emailInicial,
  envioGratisDesde = 49,
  costoEnvio = 4.95,
}: {
  emailInicial?: string;
  envioGratisDesde?: number;
  costoEnvio?: number;
}) {
  const { lineas, totalPrecio } = useCarrito();
  const [paso, setPaso]             = useState<Paso>("direccion");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [cargando, setCargando]     = useState(false);
  const [errorCI, setErrorCI]       = useState<string | null>(null);

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

  // Configuración de envío (viene del servidor, leída de config_tienda)
  const gastoEnvio = totalPrecio >= envioGratisDesde ? 0 : costoEnvio;
  const totalFinal = totalPrecio + gastoEnvio;

  function cambiar(campo: keyof DatosEnvio, valor: string) {
    setDatos((d) => ({ ...d, [campo]: valor }));
  }

  async function irAPago(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setErrorCI(null);

    const { clientSecret: cs, error } = await crearPaymentIntent(lineas);
    if (error || !cs) {
      setErrorCI(error ?? "Error al iniciar el pago");
      setCargando(false);
      return;
    }

    setClientSecret(cs);
    setPaso("pago");
    setCargando(false);
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
          <form onSubmit={irAPago} className="space-y-4">
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

            {errorCI && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
                {errorCI}
              </div>
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

        {/* PASO 2 — Pago con Stripe */}
        {paso === "pago" && clientSecret && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => setPaso("direccion")}
                className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                ← Modificar dirección
              </button>
            </div>

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
              Método de pago
            </h2>

            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                locale: "es",
                appearance: {
                  theme: "stripe",
                  variables: {
                    colorPrimary:      "#0F0F0F",
                    colorBackground:   "#ffffff",
                    colorText:         "#0F0F0F",
                    colorDanger:       "#ef4444",
                    fontFamily:        "Inter, system-ui, sans-serif",
                    borderRadius:      "0px",
                    spacingUnit:       "4px",
                  },
                },
              }}
            >
              <CheckoutForm
                datosEnvio={datos}
                onExito={() => {}}
              />
            </Elements>
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
                Envío gratis a partir de {ENVIO_GRATIS_DESDE} €
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
