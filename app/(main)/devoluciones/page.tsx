import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Devoluciones | Esencia de Belleza",
  description: "Política de devoluciones y derecho de desistimiento de Esencia de Belleza. 14 días para devolver tu pedido.",
};

export default function DevolucionesPage() {
  return (
    <main className="container-main py-16 max-w-3xl">
      <h1
        className="text-4xl font-light text-neutral-900 mb-8"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        Devoluciones
      </h1>

      <div className="space-y-6 text-neutral-600 leading-relaxed text-sm">
        <h2 className="text-xl font-light text-neutral-900 mt-4 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Derecho de desistimiento
        </h2>
        <p>
          Tiene usted derecho a desistir del presente contrato en un plazo de <strong>14 días naturales</strong> sin necesidad de justificación, contados desde la fecha de entrega del pedido.
        </p>
        <p>
          Para ejercer el derecho de desistimiento, deberá notificarnos su nombre, dirección completa y número de teléfono de contacto o dirección de correo electrónico, y su decisión de desistir del contrato a través de una declaración inequívoca (por ejemplo, por correo electrónico a{" "}
          <a href="mailto:info@esenciadebelleza.es" className="text-amber-700 hover:underline">info@esenciadebelleza.es</a>).
        </p>
        <p>
          Para cumplir el plazo de desistimiento, basta con que la comunicación relativa al ejercicio por su parte de este derecho sea enviada antes de que venza el plazo correspondiente.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Reembolso
        </h2>
        <p>
          En caso de desistimiento, le devolveremos todos los pagos recibidos, incluidos los gastos de entrega estándar (con la excepción de los gastos adicionales resultantes de la elección de una modalidad de entrega diferente a la modalidad menos costosa), sin ninguna demora indebida y en todo caso a más tardar <strong>14 días naturales</strong> desde que nos informe de su decisión.
        </p>
        <p>
          Procederemos a efectuar el reembolso utilizando el mismo medio de pago empleado para la transacción inicial. En todo caso, no incurrirá en ningún gasto como consecuencia del reembolso.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Devolución del producto
        </h2>
        <p>
          Deberá devolvernos o entregarnos directamente los bienes sin ninguna demora indebida y, en cualquier caso, a más tardar en el plazo de 14 días naturales desde que nos comunique su decisión. Solo será usted responsable de la disminución de valor de los bienes resultante de una manipulación distinta a la necesaria para establecer la naturaleza, las características y el funcionamiento de los mismos.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Excepciones al derecho de desistimiento
        </h2>
        <p>
          Por razones de higiene y salud, <strong>no se admite la devolución de artículos ya abiertos</strong>, excepto aquellos que presenten defectos de fabricación o que estuvieran en mal estado al recibirlos. Tampoco se aceptará la devolución de productos en oferta de «Outlet» por caducidad próxima, ya que son adquiridos con conocimiento de la fecha de caducidad.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Producto defectuoso o incorrecto
        </h2>
        <p>
          En caso de recibir un producto defectuoso o incorrecto, contáctenos en{" "}
          <a href="mailto:info@esenciadebelleza.es" className="text-amber-700 hover:underline">info@esenciadebelleza.es</a>{" "}
          adjuntando la siguiente información:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Foto del estado como recibe la mercancía</li>
          <li>Foto donde se aprecie la fecha de caducidad y lote del producto (si lo tuviera)</li>
          <li>Foto de la etiqueta del envío con los datos del cliente</li>
          <li>Foto del producto dañado y del estado de la caja (lateralmente, por arriba y por abajo)</li>
        </ul>
        <p>
          El vendedor responde de las faltas de conformidad que se manifiesten en un plazo de <strong>dos años</strong> desde la entrega. El consumidor deberá informar de la falta de conformidad en el plazo de dos meses desde que tuvo conocimiento de ella.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Resolución alternativa de conflictos
        </h2>
        <p>
          La Comisión Europea ha creado una plataforma de resolución de conflictos en el comercio online disponible en:{" "}
          <a href="http://ec.europa.eu/odr" target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline">ec.europa.eu/odr</a>.
        </p>
      </div>
    </main>
  );
}
