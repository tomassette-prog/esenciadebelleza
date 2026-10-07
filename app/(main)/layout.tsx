import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CarritoDrawer } from "@/components/carrito/CarritoDrawer";
import { WhatsAppFloat } from "@/components/layout/WhatsAppFloat";
import { BarraAvisoPack } from "@/components/layout/BarraAvisoPack";
import { PopupSalidaPack } from "@/components/layout/PopupSalidaPack";
import { AvisoCookies } from "@/components/layout/AvisoCookies";
import type { ReactNode } from "react";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BarraAvisoPack />
      <Header />
      <CarritoDrawer />
      <PopupSalidaPack />
      {children}
      <Footer />
      <WhatsAppFloat />
      <AvisoCookies />
    </>
  );
}
