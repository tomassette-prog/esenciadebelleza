import type { Metadata } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import { buildOrganizationJsonLd } from "@/lib/seo";
import { CarritoProvider } from "@/context/CarritoContext";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://esenciadebelleza.es"),
  title: {
    default: "Esencia de Belleza | Productos de Peluquería y Estética",
    template: "%s | Esencia de Belleza",
  },
  description:
    "Tienda online de productos profesionales de peluquería, estética y perfumería. Precios para particulares y profesionales. Envío rápido en España.",
  keywords: ["peluquería", "estética", "tintes", "champú", "perfumes", "productos profesionales"],
  authors: [{ name: "Esencia de Belleza" }],
  creator: "Esencia de Belleza",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: { url: "/favicon.svg", type: "image/svg+xml" },
    shortcut: "/favicon.svg",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "https://esenciadebelleza.es",
    siteName: "Esencia de Belleza",
    images: [
      {
        url: "https://esenciadebelleza.es/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "Esencia de Belleza — Peluquería · Estética · Perfumes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@esenciadebelleza",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION ?? "ywMmHXPdPu-R7nA5JBfSM0K9IWhTF09cVJZIFpxpuMA",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const orgJsonLd = buildOrganizationJsonLd();

  return (
    <html lang="es" className={`${inter.variable} ${cormorant.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </head>
      <body className="bg-white text-neutral-900 antialiased font-sans">
        <CarritoProvider>
          {children}
        </CarritoProvider>
      </body>
    </html>
  );
}
