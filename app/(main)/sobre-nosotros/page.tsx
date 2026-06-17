import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sobre Nosotros | Esencia de Belleza",
  description:
    "Conoce Esencia de Belleza, tienda especializada en productos profesionales de peluquería, estética y perfumería con precios especiales para profesionales del sector.",
};

export default function SobreNosotrosPage() {
  return (
    <main className="container-main py-16 max-w-3xl">
      <h1
        className="text-4xl font-light text-neutral-900 mb-8"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        Sobre Nosotros
      </h1>

      <div className="prose prose-neutral max-w-none space-y-6 text-neutral-600 leading-relaxed">
        <p>
          <strong className="text-neutral-900">Esencia de Belleza</strong> es una tienda online especializada en la venta y distribución de productos profesionales de peluquería, estética y perfumería. Nacemos con la vocación de poner al alcance de profesionales del sector y de particulares exigentes los mejores productos del mercado, a precios competitivos y con la garantía de marcas de referencia.
        </p>

        <p>
          Nuestra tienda está gestionada por Sandra Navarro Torres, con domicilio en Calle Torrente nº 2, Catarroja (Valencia), y con una larga trayectoria en el sector de la belleza profesional. La experiencia acumulada nos permite seleccionar cuidadosamente cada producto que ofrecemos, asegurándonos de que cumple con los estándares de calidad que nuestros clientes merecen.
        </p>

        <h2
          className="text-2xl font-light text-neutral-900 mt-10 mb-4"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Nuestra misión
        </h2>
        <p>
          Queremos ser el referente online para profesionales de la peluquería y la estética en España. Para ello, trabajamos con distribuidores oficiales de las principales marcas del sector, garantizando la autenticidad de cada producto y ofreciendo un servicio de atención al cliente cercano y especializado.
        </p>

        <h2
          className="text-2xl font-light text-neutral-900 mt-10 mb-4"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Precios para profesionales
        </h2>
        <p>
          En Esencia de Belleza creemos que los profesionales del sector merecen precios justos. Por eso, ofrecemos tarifas especiales para peluqueros, esteticistas y centros de belleza registrados. Si eres profesional, regístrate con tu información profesional y accede a descuentos exclusivos.
        </p>

        <h2
          className="text-2xl font-light text-neutral-900 mt-10 mb-4"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Envíos y atención al cliente
        </h2>
        <p>
          Enviamos a toda España peninsular, Baleares, Canarias, Ceuta y Melilla. Todos nuestros pedidos viajan con seguro de mercancía al 100% del valor. Para cualquier consulta, duda o incidencia, puedes contactarnos en{" "}
          <a
            href="mailto:info@esenciadebelleza.es"
            className="text-amber-700 hover:underline"
          >
            info@esenciadebelleza.es
          </a>
          . Estamos aquí para ayudarte.
        </p>
      </div>
    </main>
  );
}
