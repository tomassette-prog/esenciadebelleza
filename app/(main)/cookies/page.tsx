import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Cookies | Esencia de Belleza",
  description: "Política de cookies de Esencia de Belleza. Información sobre el uso de cookies conforme al RGPD.",
};

export default function CookiesPage() {
  return (
    <main className="container-main py-16 max-w-3xl">
      <h1
        className="text-4xl font-light text-neutral-900 mb-8"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        Política de Cookies
      </h1>

      <div className="space-y-6 text-neutral-600 leading-relaxed text-sm">
        <p>
          En cumplimiento con la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y Comercio Electrónico, y con el Reglamento (UE) 2016/679 (RGPD), <strong>Esencia de Belleza</strong> le informa sobre el uso de cookies en el sitio web <strong>www.esenciadebelleza.es</strong>.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          ¿Qué son las cookies?
        </h2>
        <p>
          Las cookies son pequeños archivos de texto que los sitios web almacenan en su navegador cuando los visita. Se utilizan ampliamente para hacer que los sitios web funcionen de manera más eficiente, así como para proporcionar información a los propietarios del sitio.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          ¿Qué cookies utiliza este sitio web?
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left py-2 pr-4 font-medium text-neutral-900">Nombre</th>
                <th className="text-left py-2 pr-4 font-medium text-neutral-900">Finalidad</th>
                <th className="text-left py-2 font-medium text-neutral-900">Duración</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              <tr>
                <td className="py-2 pr-4 font-mono text-neutral-500">sb-*-auth-token</td>
                <td className="py-2 pr-4">Sesión de usuario autenticado (Supabase)</td>
                <td className="py-2">Sesión / 7 días</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-neutral-500">__stripe_*</td>
                <td className="py-2 pr-4">Procesamiento de pagos seguro (Stripe)</td>
                <td className="py-2">Sesión</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-neutral-500">_ga, _gid</td>
                <td className="py-2 pr-4">Análisis de uso del sitio web (Google Analytics)</td>
                <td className="py-2">2 años / 24h</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Tipos de cookies
        </h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Cookies técnicas o necesarias:</strong> imprescindibles para el funcionamiento del sitio web. Incluyen las cookies de sesión de usuario y las de seguridad en el pago. No pueden desactivarse.
          </li>
          <li>
            <strong>Cookies analíticas:</strong> nos permiten conocer cómo los usuarios interactúan con el sitio para mejorar su funcionamiento. Solo se utilizan si da su consentimiento.
          </li>
          <li>
            <strong>Cookies de terceros:</strong> Stripe utiliza cookies propias para garantizar la seguridad del pago. Consulte la política de cookies de{" "}
            <a href="https://stripe.com/es/privacy" target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline">Stripe</a>{" "}
            para más información.
          </li>
        </ul>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          ¿Cómo desactivar o eliminar las cookies?
        </h2>
        <p>
          Puede configurar su navegador para que rechace o elimine las cookies. Tenga en cuenta que deshabilitar las cookies técnicas puede afectar al funcionamiento del sitio web, incluyendo la posibilidad de iniciar sesión o completar una compra.
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline">Google Chrome</a></li>
          <li><a href="https://support.mozilla.org/es/kb/habilitar-y-deshabilitar-cookies" target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline">Mozilla Firefox</a></li>
          <li><a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline">Safari</a></li>
          <li><a href="https://support.microsoft.com/es-es/windows/eliminar-y-administrar-cookies" target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline">Microsoft Edge</a></li>
        </ul>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Contacto
        </h2>
        <p>
          Para cualquier duda sobre nuestra política de cookies, puede contactarnos en{" "}
          <a href="mailto:info@esenciadebelleza.es" className="text-amber-700 hover:underline">info@esenciadebelleza.es</a>.
        </p>
      </div>
    </main>
  );
}
