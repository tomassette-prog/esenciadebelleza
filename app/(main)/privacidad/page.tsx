import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad | Esencia de Belleza",
  description: "Política de privacidad de Esencia de Belleza. Información sobre el tratamiento de sus datos personales conforme al RGPD.",
};

export default function PrivacidadPage() {
  return (
    <main className="container-main py-16 max-w-3xl">
      <h1
        className="text-4xl font-light text-neutral-900 mb-8"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        Política de Privacidad
      </h1>

      <div className="space-y-6 text-neutral-600 leading-relaxed text-sm">
        <p>
          En cumplimiento con el Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo, de 27 de abril de 2016 (RGPD), le ofrecemos la siguiente información sobre el tratamiento de sus datos personales.
        </p>

        <p>
          Existen distintas formas de que sus datos personales o comerciales pasen a nuestro fichero y, por tanto, distintas finalidades y usos de sus datos en el futuro, siempre con su consentimiento:
        </p>

        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Suscripción a boletines:</strong> Al registrarse en la web quedará suscrito a nuestros boletines y la finalidad será enviarle cualquier tipo de información acerca de esenciadebelleza.es (promociones, descuentos, nuevos productos, ofertas, información corporativa, etc.).
          </li>
          <li>
            <strong>Formulario de contacto o consulta:</strong> Si da su consentimiento antes del envío, sus datos formarán parte de nuestro fichero con el fin de remitirle la información solicitada.
          </li>
          <li>
            <strong>Registro como usuario:</strong> Si da su consentimiento antes del envío del formulario de registro, sus datos formarán parte de nuestro fichero y la finalidad será identificarle en próximos accesos mediante las claves asignadas y enviarle información general acerca de esenciadebelleza.es.
          </li>
        </ul>

        <p>
          En todo momento podrá dirigirse a{" "}
          <a href="mailto:info@esenciadebelleza.es" className="text-amber-700 hover:underline">
            info@esenciadebelleza.es
          </a>{" "}
          para rectificar sus preferencias respecto a la información a recibir, el deseo de no recibir ningún tipo de información, o cambiar sus datos personales.
        </p>

        <p>
          La desuscripción de recibir información general o de cualquier tipo es siempre automática desde cualquier comunicado que reciba, desde el área privada del usuario, o bien mandando un mail a{" "}
          <a href="mailto:info@esenciadebelleza.es" className="text-amber-700 hover:underline">
            info@esenciadebelleza.es
          </a>.
        </p>

        <p>
          Si se ha registrado y/o suscrito o ha dado su consentimiento en alguno de los formularios de contacto existentes en esenciadebelleza.es, sus datos pasarán a formar parte de un fichero automatizado propiedad de <strong>Sandra Navarro Torres</strong>, con la finalidad de identificarle en el caso del registro como usuario, mantenerle informado en caso de suscripción y enviarle información comercial de esenciadebelleza.es. En cualquier caso, y siempre que haya dado su conformidad para recibir este tipo de información.
        </p>

        <p>
          Usted tiene derecho a acceder a este fichero para información, rectificación o, en su caso, cancelación de sus datos cuando así lo desee.
        </p>

        <p>
          Si sus datos han sido recogidos para la utilización de algún servicio de información que no requiera registro o suscripción y no ha dado su consentimiento para recibir información futura, estos serán eliminados una vez resuelta la consulta o información solicitada.
        </p>

        <h2
          className="text-2xl font-light text-neutral-900 mt-10 mb-4"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Ejercicio de derechos
        </h2>
        <p>
          Los usuarios cuyos datos sean objeto de tratamiento podrán ejercer gratuitamente los derechos de acceso, rectificación, supresión, limitación, oposición, portabilidad y derecho al olvido especificados en el Reglamento (UE) 2016/679, dirigiendo comunicación por escrito a <strong>Sandra Navarro Torres</strong>, Calle Torrente nº 2, 46470 Catarroja (Valencia), o por correo electrónico a{" "}
          <a href="mailto:info@esenciadebelleza.es" className="text-amber-700 hover:underline">
            info@esenciadebelleza.es
          </a>
          , adjuntando fotocopia del DNI e indicando en el asunto «PROTECCIÓN DE DATOS».
        </p>
      </div>
    </main>
  );
}
