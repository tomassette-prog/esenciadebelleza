import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CarritoDrawer } from "@/components/carrito/CarritoDrawer";
import { WhatsAppFloat } from "@/components/layout/WhatsAppFloat";
import type { ReactNode } from "react";

// Forzar que el layout se regenere dinámicamente (no usar caché estático)
export const revalidate = 0;
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <CarritoDrawer />
      {children}
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
