import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CarritoDrawer } from "@/components/carrito/CarritoDrawer";
import { WhatsAppFloat } from "@/components/layout/WhatsAppFloat";
import type { ReactNode } from "react";

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
