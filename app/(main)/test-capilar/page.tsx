import type { Metadata } from "next";
import TestCapilar from "@/components/test/TestCapilar";

export const metadata: Metadata = {
  title: "Test Anticaída en 60 segundos — ¿Por qué se te cae el pelo? | Esencia de Belleza",
  description:
    "Descubre en 60 segundos por qué se te cae el pelo este otoño y qué hacer: test gratuito con diagnóstico personalizado y tu plan anticaída. Asesoramiento experto de peluquería profesional.",
  openGraph: {
    title: "Test Anticaída en 60 segundos — ¿Por qué se te cae el pelo?",
    description:
      "Diagnóstico capilar gratuito: descubre tu tipo de caída y tu plan anticaída personalizado.",
    url: "https://esenciadebelleza.es/test-capilar",
    siteName: "Esencia de Belleza",
    locale: "es_ES",
    type: "website",
  },
};

export default function TestCapilarPage() {
  return (
    <main className="container-main py-12">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs tracking-widest uppercase text-[#C4857A] mb-3 text-center">
          Diagnóstico gratuito · Esencia de Belleza
        </p>
        <h1
          className="text-4xl font-light text-neutral-900 mb-4 text-center leading-tight"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          ¿Por qué se te cae el pelo?
        </h1>
        <p className="text-neutral-600 text-center mb-10">
          En otoño el pelo cae más: es biología, no mala suerte. Responde 6 preguntas y
          descubre tu tipo de caída y tu plan para frenarla.
        </p>
        <TestCapilar />
        <p className="text-xs text-neutral-400 text-center mt-8">
          Test orientativo con fines informativos. No sustituye el diagnóstico de un
          dermatólogo.
        </p>
      </div>
    </main>
  );
}
