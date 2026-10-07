"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export const META_PIXEL_ID = "4697648940471456";
export const CONSENT_KEY = "eb_cookie_consent";

type FbqStub = ((...args: string[]) => void) & {
  queue: string[][];
  callMethod?: unknown;
  version?: string;
  loaded?: boolean;
};

declare global {
  interface Window {
    fbq?: FbqStub;
    _fbq?: FbqStub;
  }
}

// Carga el píxel de Meta (mismo stub que el código base oficial). Solo debe
// llamarse tras el consentimiento de cookies del usuario.
function inyectarPixel() {
  if (window.fbq) return;
  const stub = ((...args: string[]) => {
    if (stub.callMethod) {
      (stub.callMethod as (...a: string[]) => void).apply(stub, args);
    } else {
      stub.queue.push(args);
    }
  }) as FbqStub;
  stub.queue = [];
  stub.version = "2.0";
  stub.loaded = true;
  window.fbq = stub;
  window._fbq = stub;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  const primero = document.getElementsByTagName("script")[0];
  primero?.parentNode?.insertBefore(script, primero);
  stub("init", META_PIXEL_ID);
}

function trackRuta(pathname: string) {
  const fbq = window.fbq;
  if (!fbq) return;
  fbq("track", "PageView");
  if (pathname.startsWith("/checkout")) fbq("track", "InitiateCheckout");
  else if (pathname.startsWith("/productos/") || pathname.startsWith("/packs/")) fbq("track", "ViewContent");
}

export function MetaPixel() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      if (localStorage.getItem(CONSENT_KEY) !== "accepted") return;
    } catch {
      return;
    }
    inyectarPixel();
    trackRuta(pathname);
  }, [pathname]);

  return null;
}
