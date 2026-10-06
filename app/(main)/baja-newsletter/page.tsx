import type { Metadata } from "next";
import { darseDeBajaNewsletter } from "@/actions/newsletter";

export const metadata: Metadata = {
  title: "Baja del boletín",
  robots: { index: false, follow: false },
};

export default async function BajaNewsletterPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const res = await darseDeBajaNewsletter(searchParams.token ?? "");

  return (
    <main className="container-main py-24 max-w-lg mx-auto text-center">
      <h1
        className="text-3xl font-light text-neutral-900 mb-4"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        Baja realizada
      </h1>
      <p className="text-sm text-neutral-500 leading-relaxed">{res.mensaje}</p>
      <a
        href="/"
        className="inline-block mt-8 text-xs tracking-widest uppercase border-b border-neutral-900 pb-1"
      >
        Volver a la tienda
      </a>
    </main>
  );
}
