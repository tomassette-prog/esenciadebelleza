import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Aviso Legal | Esencia de Belleza",
  description: "Aviso legal y condiciones generales de uso y contratación de Esencia de Belleza.",
};

export default function AvisoLegalPage() {
  return (
    <main className="container-main py-16 max-w-3xl">
      <h1
        className="text-4xl font-light text-neutral-900 mb-8"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        Aviso Legal y Condiciones Generales
      </h1>

      <div className="space-y-6 text-neutral-600 leading-relaxed text-sm">
        <p>
          Damos la bienvenida a Esencia de Belleza y te agradecemos tu interés por leer los términos legales que regulan nuestra página web. Las presentes condiciones generales rigen única y exclusivamente el uso del sitio web de <strong>www.esenciadebelleza.es</strong> por parte de los usuarios que accedan al mismo.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Primera — Información
        </h2>
        <p>
          <strong>Sandra Navarro Torres</strong>, con domicilio en Calle Torrente nº 2, 46470 Catarroja (Valencia), correo electrónico{" "}
          <a href="mailto:info@esenciadebelleza.es" className="text-amber-700 hover:underline">info@esenciadebelleza.es</a>
          , en adelante denominada «Esencia de Belleza», pone a disposición en su sitio web <strong>www.esenciadebelleza.es</strong> determinados contenidos de carácter informativo sobre sus actividades y la posibilidad de comprar los productos que se ofrecen.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Segunda — Condiciones generales de uso y acceso
        </h2>
        <p>
          La utilización del sitio web de Esencia de Belleza no conlleva la obligatoriedad de inscripción del usuario salvo que desee utilizar el catálogo de productos para realizar un pedido, o utilizar el servicio de atención al cliente, donde será preciso que se almacenen ciertos datos, los cuales se protegerán y se garantizará la confidencialidad conforme a la normativa vigente en materia de protección de datos.
        </p>
        <p>
          Quedan prohibidos todos los actos que vulneren la legalidad, derechos o intereses de terceros. Expresamente Esencia de Belleza prohíbe: realizar acciones que puedan inutilizar o sobrecargar el portal; envíos de correos masivos; la reproducción o distribución no autorizada de contenidos; cualquier conducta que pueda dañar la imagen o intereses de Esencia de Belleza o de terceros.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Tercera — Medidas de seguridad
        </h2>
        <p>
          Los datos registrados se adecúan a las exigencias de la Ley Orgánica 15/1999 (LOPD) y al Reglamento (UE) 2016/679 (RGPD), así como a la Ley 34/2002 de Servicios de la Sociedad de la Información (LSSICE). La comunicación entre los usuarios y Esencia de Belleza utiliza un canal seguro cifrado mediante protocolos HTTPS de 256 bits.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Cuarta — Derechos de propiedad intelectual e industrial
        </h2>
        <p>
          Los contenidos de este sitio web están protegidos por marcas, derechos de autor y otros derechos legítimos. Queda prohibida la reproducción, distribución y comunicación pública, con fines comerciales, de la totalidad o parte de los contenidos de esta página web sin autorización expresa de Esencia de Belleza.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Quinta — Responsabilidad
        </h2>
        <p>
          Esencia de Belleza no será responsable de: los fallos e incidencias que pudieran producirse en las comunicaciones; los daños que los usuarios o terceros puedan ocasionar en el sitio web; la falta de disponibilidad o mantenimiento del web o sus servicios; ni del uso ilícito, negligente o fraudulento de los servicios.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Sexta — Reclamaciones
        </h2>
        <p>
          El usuario podrá realizar reclamaciones remitiendo un correo electrónico a{" "}
          <a href="mailto:info@esenciadebelleza.es" className="text-amber-700 hover:underline">info@esenciadebelleza.es</a>{" "}
          indicando su nombre y apellidos, el producto/servicio adquirido y exponiendo los motivos de su reclamación. También dispone de la plataforma de resolución de litigios de la Comisión Europea:{" "}
          <a href="http://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline">
            ec.europa.eu/consumers/odr
          </a>.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Séptima — Jurisdicción y ley aplicable
        </h2>
        <p>
          Las presentes Condiciones Generales se rigen por la legislación española. Las partes se someten, para la resolución de los conflictos y con renuncia a cualquier otro fuero, a los juzgados y tribunales de Catarroja (Valencia).
        </p>

        {/* CONDICIONES DE CONTRATACIÓN */}
        <h2
          className="text-2xl font-light text-neutral-900 mt-12 mb-4 pt-8 border-t border-neutral-100"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Condiciones Generales de Contratación
        </h2>

        <p>
          Estos términos y condiciones, junto con la confirmación de pedido, constituyen un contrato entre Esencia de Belleza y el comprador. Si no está de acuerdo con alguna parte de los términos, no deberá realizar su pedido.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Primera — Información importante
        </h2>
        <p>
          Según las condiciones de uso, al ser rechazado un envío por motivos personales del cliente, es responsabilidad del mismo hacerse cargo de los portes de ida y vuelta del pedido. Las presentes condiciones están formuladas de conformidad con los Códigos Civiles y de Comercio, Ley 7/1996 de Ordenación del Comercio Minorista, Ley 7/1998 de Condiciones Generales de la Contratación y Ley 7/1995 de Crédito al Consumo. Para poder realizar un pedido, el comprador deberá tener un mínimo de 18 años.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Segunda — Identificación del vendedor
        </h2>
        <p>
          En virtud de lo establecido en la Ley 34/2002 (LSSICE): la actividad social a la que se dedica la empresa es la «Venta y distribución de productos de peluquería y estética». Responsable: Sandra Navarro Torres, Calle Torrente nº 2, 46470 Catarroja (Valencia).
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Tercera — Condiciones del contrato
        </h2>
        <p>
          Como condición para realizar cualquier pedido, el usuario debe proporcionar la información requerida para la correcta realización del envío. La información proporcionada debe ser precisa, completa y actualizada. Una vez efectuada la compra y realizado el pago, Esencia de Belleza remitirá por e-mail una confirmación de que su pedido está siendo procesado. En el plazo más breve posible, siempre antes de 24 horas laborables, se remitirá la confirmación de envío con el número de seguimiento.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Cuarta — IVA y precios
        </h2>
        <p>
          El precio de los productos vendidos por Esencia de Belleza incluye el IVA español. Para pedidos con destino a otros países de la Unión Europea, el IVA español podrá ser deducido y se aplicará el tipo impositivo correspondiente al país de destino. Para pedidos fuera de la UE, estarán exentos de IVA en concepto de exportación. Los precios pueden cambiar en cualquier momento sin que ello genere derecho a reembolso retroactivo.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Quinta — Derecho de desistimiento
        </h2>
        <p>
          Tiene usted derecho a desistir del presente contrato en un plazo de <strong>14 días naturales</strong> sin necesidad de justificación, contados desde la fecha de entrega del pedido. Para ejercer este derecho, notifíquenos su decisión a{" "}
          <a href="mailto:info@esenciadebelleza.es" className="text-amber-700 hover:underline">info@esenciadebelleza.es</a>.
          Le devolveremos todos los pagos recibidos, incluidos los gastos de entrega estándar, en un plazo máximo de 14 días naturales desde que nos informe de su decisión.
        </p>
        <p>
          Por cuestión de higiene y salud, los artículos no admitirán cambio o devolución una vez abiertos, excepto aquellos que tuvieran defectos de fabricación o estuvieran en mal estado.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Sexta — Garantías legales
        </h2>
        <p>
          En caso de producto defectuoso, Esencia de Belleza procederá, según corresponda, a la reparación, sustitución, rebaja del precio o resolución del contrato, gestiones que serán gratuitas para el consumidor. El vendedor responde de las faltas de conformidad que se manifiesten en un plazo de <strong>dos años</strong> desde la entrega.
        </p>

        <h2 className="text-xl font-light text-neutral-900 mt-8 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
          Séptima — Confidencialidad y protección de datos
        </h2>
        <p>
          Toda la información y documentación utilizada durante la contratación tiene carácter confidencial. Esencia de Belleza se compromete al cumplimiento de su obligación de secreto de los datos de carácter personal y de adoptar las medidas de seguridad exigidas por la legislación aplicable.
        </p>

        <p className="mt-8 text-xs text-neutral-400">
          Para cualquier duda sobre estas condiciones legales, contacte con nosotros en{" "}
          <a href="mailto:info@esenciadebelleza.es" className="text-amber-700 hover:underline">info@esenciadebelleza.es</a>.
        </p>
      </div>
    </main>
  );
}
