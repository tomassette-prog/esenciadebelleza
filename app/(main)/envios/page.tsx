import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Envíos | Esencia de Belleza",
  description: "Información sobre plazos de entrega, gastos de envío y condiciones de transporte de Esencia de Belleza.",
};

export default function EnviosPage() {
  return (
    <main className="container-main py-16 max-w-3xl">
      <h1
        className="text-4xl font-light text-neutral-900 mb-8"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        Política de Envíos
      </h1>

      <div className="space-y-6 text-neutral-600 leading-relaxed text-sm">
        <h2 className="text-xl font-light text-neutral-900 mt-4 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Plazos de entrega
        </h2>
        <p>
          Los plazos de entrega están indicados en días laborables (de lunes a viernes) y comenzarán a contar desde la confirmación del pago en nuestra cuenta bancaria o TPV Virtual.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Particulares — envío express:</strong> entrega al día siguiente de realizarse el pedido (24h) para pedidos realizados de lunes a viernes antes de las 15:00h.
          </li>
          <li>
            <strong>Particulares — envío express (tarde):</strong> entrega al día siguiente de ser puesto el pedido en reparto (36h) para pedidos realizados de lunes a viernes después de las 15:00h.
          </li>
          <li>
            <strong>Profesionales:</strong> los pedidos de profesionales serán entregados en un plazo de 48–72h mediante mensajería especial paletizada.
          </li>
        </ul>
        <p>
          Esencia de Belleza no aceptará emitir reembolsos ni la cancelación del pedido por retrasos debidos a error en los datos de entrega facilitados por el cliente o a ausencias en el momento de la entrega.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Gastos de envío
        </h2>
        <p>
          Los gastos de envío varían según la zona de destino:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left py-2 pr-4 font-medium text-neutral-900">Zona</th>
                <th className="text-left py-2 font-medium text-neutral-900">Tarifa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              <tr><td className="py-2 pr-4">Provincia de Barcelona</td><td className="py-2">3,50 €</td></tr>
              <tr><td className="py-2 pr-4">Cataluña (resto)</td><td className="py-2">4,00 €</td></tr>
              <tr><td className="py-2 pr-4">Península</td><td className="py-2">4,50 €</td></tr>
              <tr><td className="py-2 pr-4">Islas Baleares</td><td className="py-2">10,00 €</td></tr>
              <tr><td className="py-2 pr-4">Portugal</td><td className="py-2">4,50 €</td></tr>
              <tr><td className="py-2 pr-4">Islas Canarias</td><td className="py-2">10,00 €</td></tr>
              <tr><td className="py-2 pr-4">Andorra / Gibraltar</td><td className="py-2">8,00 €</td></tr>
              <tr><td className="py-2 pr-4">Ceuta / Melilla</td><td className="py-2">20,00 €</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Los pedidos que incluyan productos marcados con «Envío gratis» o que cumplan las condiciones de importe mínimo establecidas tendrán envío gratuito en todo el pedido.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Seguro de transporte
        </h2>
        <p>
          Todos los pedidos viajan cubiertos con un seguro por el <strong>100% del valor de la mercancía</strong>. En caso de que su envío presente desperfectos debidos al transporte, deberá indicar las anomalías en el albarán del transportista en el momento de la entrega y contactar con nosotros en la mayor brevedad posible. Le recomendamos no tirar el embalaje hasta comprobar que todos los productos están en perfecto estado.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Gestión aduanera
        </h2>
        <p>
          Los envíos a Canarias, Ceuta, Melilla y otras zonas que requieran la gestión de un agente de aduanas pueden conllevar gastos adicionales (despacho de aduanas, impuestos locales, etc.) de los que Esencia de Belleza no se hace responsable.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Incidencias en el envío
        </h2>
        <p>
          En caso de incumplimiento de la fecha de entrega en más de <strong>14 días laborables</strong> por causas imputables a Esencia de Belleza, el comprador podrá optar por anular el pedido y recibir el importe abonado. Para cualquier incidencia, contacte con nosotros en{" "}
          <a href="mailto:info@esenciadebelleza.es" className="text-amber-700 hover:underline">info@esenciadebelleza.es</a>.
        </p>
      </div>
    </main>
  );
}
