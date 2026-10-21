import { enviarEmail } from "@/lib/email";

// Email templates for the conversion flows: post-purchase review requests,
// abandoned-cart reminders and restock notices.

const WEB = "https://esenciadebelleza.es";

function plantilla(contenido: string): string {
  return `
  <div style="font-family:Georgia,serif;background:#fdf6f4;padding:32px 16px">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #eee;padding:32px">
      <p style="font-size:22px;color:#3D2018;margin:0 0 4px">Esencia de Belleza</p>
      ${contenido}
      <hr style="border:none;border-top:1px solid #eee;margin:28px 0 16px" />
      <p style="font-size:11px;color:#999;margin:0">
        Peluquería · Estética · Perfumería profesional — <a href="${WEB}" style="color:#C4857A">esenciadebelleza.es</a><br/>
        Si no quieres recibir estos mensajes, responde a este email y te damos de baja.
      </p>
    </div>
  </div>`;
}

function boton(href: string, texto: string): string {
  return `<a href="${href}" style="display:inline-block;background:#3D2018;color:#fff;padding:12px 28px;text-decoration:none;font-size:13px;letter-spacing:1px">${texto}</a>`;
}

// ── 1. Solicitud de reseña post-pedido ───────────────────────────────────────

export async function enviarSolicitudResena(p: {
  email: string;
  pedidoRef: string;
  productos: { nombre: string; urlResena: string }[];
}) {
  const items = p.productos
    .map((prod) => `
      <p style="font-size:14px;color:#3D2018;margin:20px 0 8px">${prod.nombre}</p>
      ${boton(prod.urlResena, "Dejar mi reseña")}`)
    .join("");

  await enviarEmail({
    to: p.email,
    subject: `⭐ ¿Qué te ha parecido tu pedido ${p.pedidoRef}? — Esencia de Belleza`,
    html: plantilla(`
      <h1 style="font-size:20px;font-weight:normal;color:#3D2018;margin:16px 0">Gracias por tu compra</h1>
      <p style="font-size:14px;color:#555;line-height:1.7">
        Esperamos que estés disfrutando tu pedido <strong>${p.pedidoRef}</strong>.
        Tu opinión ayuda a otras personas a elegir y a nosotros a mejorar.
      </p>
      ${items}
      <p style="font-size:12px;color:#888;margin-top:24px">
        Tarda menos de un minuto. Las reseñas se publican tras una breve revisión.
      </p>`),
  });
}

// ── 2. Recordatorio de carrito abandonado ────────────────────────────────────

export async function enviarRecordatorioCarrito(p: {
  email: string;
  items: { nombre: string; cantidad: number; precio: number }[];
  total: number;
  urlRecuperar: string;
}) {
  const filas = p.items
    .slice(0, 6)
    .map((i) => `<tr>
        <td style="padding:8px 0;font-size:13px;color:#3D2018">${i.nombre} × ${i.cantidad}</td>
        <td style="padding:8px 0;font-size:13px;color:#3D2018;text-align:right">${i.precio.toFixed(2)} €</td>
      </tr>`)
    .join("");

  await enviarEmail({
    to: p.email,
    subject: "🛒 Te has olvidado algo en Esencia de Belleza",
    html: plantilla(`
      <h1 style="font-size:20px;font-weight:normal;color:#3D2018;margin:16px 0">Tu carrito te espera</h1>
      <p style="font-size:14px;color:#555;line-height:1.7">
        Guardamos los artículos que tenías en el carrito. Puedes recuperar tu compra
        con un clic — el stock depende del proveedor, así que no esperes demasiado.
      </p>
      <table style="width:100%;margin:20px 0;border-collapse:collapse">${filas}</table>
      <p style="font-size:15px;color:#3D2018;text-align:right;margin:0 0 20px">
        <strong>Total: ${p.total.toFixed(2)} €</strong>
      </p>
      ${boton(p.urlRecuperar, "Recuperar mi carrito")}`),
  });
}

// ── 3. Aviso de reposición ───────────────────────────────────────────────────

export async function enviarAvisoReposicion(p: {
  email: string;
  nombre: string;
  urlProducto: string;
  precio: number | null;
}) {
  await enviarEmail({
    to: p.email,
    subject: `✅ Ya disponible: ${p.nombre} — Esencia de Belleza`,
    html: plantilla(`
      <h1 style="font-size:20px;font-weight:normal;color:#3D2018;margin:16px 0">Buenas noticias: ya vuelve a estar disponible</h1>
      <p style="font-size:14px;color:#555;line-height:1.7">
        Pediste un aviso cuando volviera a haber stock de
        <strong>${p.nombre}</strong>${p.precio ? ` (<strong>${p.precio.toFixed(2)} €</strong>)` : ""}.
        Ya está disponible — recuerda que no reservamos stock y puede agotarse de nuevo.
      </p>
      ${boton(p.urlProducto, "Ver producto")}`),
  });
}
