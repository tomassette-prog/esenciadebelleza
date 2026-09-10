import nodemailer from "nodemailer";

const ADMIN_EMAILS = [
  "ziarresamot@gmail.com",
  "depeluqueriaproductos@gmail.com",
];
const FROM_EMAIL  = process.env.EMAIL_FROM ?? "pedidos@esenciadebelleza.es";

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST   ?? "smtp.dondominio.com",
    port:   Number(process.env.EMAIL_PORT ?? 465),
    secure: (process.env.EMAIL_PORT ?? "465") === "465",
    auth: {
      user: process.env.EMAIL_USER ?? FROM_EMAIL,
      pass: process.env.EMAIL_PASS,
    },
  });
}

export interface PedidoNotificacion {
  pedidoId:     string;
  email:        string;
  nombre:       string;
  apellidos:    string;
  total:        number;
  gastoEnvio:   number;
  descuento?:   number;
  codigoCupon?: string;
  metodoPago:   string;
  tipoPrecio:   string;
  provincia:    string;
  ciudad:       string;
  lineas:       { nombre: string; nombre_variacion?: string; cantidad: number; precio: number }[];
}

export async function enviarNotificacionPedido(p: PedidoNotificacion) {
  if (!process.env.EMAIL_PASS) {
    console.warn("[Email] EMAIL_PASS no configurado, saltando notificación");
    return;
  }

  const lineasHtml = p.lineas
    .map(
      (l) =>
        `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #f0e8e6">${l.nombre}${l.nombre_variacion ? ` — ${l.nombre_variacion}` : ""}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f0e8e6;text-align:center">${l.cantidad}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f0e8e6;text-align:right">${(l.precio * l.cantidad).toFixed(2)} €</td>
        </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Nuevo pedido</title></head>
<body style="font-family:sans-serif;color:#3D2018;background:#fff;margin:0;padding:0">
  <div style="max-width:600px;margin:30px auto;border:1px solid #f0e8e6;border-radius:8px;overflow:hidden">
    <div style="background:#C4857A;padding:20px 30px">
      <h1 style="color:#fff;margin:0;font-size:20px">🛍️ Nuevo pedido recibido</h1>
    </div>
    <div style="padding:24px 30px">
      <p style="margin:0 0 16px"><strong>Pedido:</strong> #${p.pedidoId}</p>
      <p style="margin:0 0 6px"><strong>Cliente:</strong> ${p.nombre} ${p.apellidos}</p>
      <p style="margin:0 0 6px"><strong>Email:</strong> ${p.email}</p>
      <p style="margin:0 0 6px"><strong>Destino:</strong> ${p.ciudad} (${p.provincia})</p>
      <p style="margin:0 0 16px"><strong>Método de pago:</strong> ${p.metodoPago}${p.tipoPrecio === "b2b" ? " · <em>Cliente B2B</em>" : ""}</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead>
          <tr style="background:#fdf5f4">
            <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #C4857A">Producto</th>
            <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #C4857A">Uds.</th>
            <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #C4857A">Subtotal</th>
          </tr>
        </thead>
        <tbody>${lineasHtml}</tbody>
      </table>

      <p style="text-align:right;margin:4px 0"><strong>Envío:</strong> ${p.gastoEnvio > 0 ? `${p.gastoEnvio.toFixed(2)} €` : "Gratuito"}</p>
      ${(p.descuento ?? 0) > 0 ? `<p style="text-align:right;margin:4px 0;color:#16a34a"><strong>Descuento${p.codigoCupon ? ` (${p.codigoCupon})` : ""}:</strong> −${p.descuento!.toFixed(2)} €</p>` : ""}
      <p style="text-align:right;margin:4px 0;font-size:18px"><strong>Total:</strong> ${p.total.toFixed(2)} €</p>

      <div style="margin-top:24px;text-align:center">
        <a href="https://esenciadebelleza.es/admin/pedidos" style="background:#C4857A;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-size:14px">Ver pedido en el panel</a>
      </div>
    </div>
  </div>
</body>
</html>`;

  try {
    const transporter = createTransport();
    await transporter.sendMail({
      from:    `"Esencia de Belleza" <${FROM_EMAIL}>`,
      to:      ADMIN_EMAILS,
      subject: `🛍️ Nuevo pedido — ${p.nombre} ${p.apellidos} · ${p.total.toFixed(2)} €`,
      html,
    });
  } catch (err) {
    console.error("[Email] Error enviando notificación de pedido:", err);
  }
}

export async function enviarConfirmacionCliente(p: PedidoNotificacion) {
  if (!process.env.EMAIL_PASS) return;

  const lineasHtml = p.lineas
    .map(
      (l) =>
        `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #f0e8e6">${l.nombre}${l.nombre_variacion ? ` — ${l.nombre_variacion}` : ""}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f0e8e6;text-align:center">${l.cantidad}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f0e8e6;text-align:right">${(l.precio * l.cantidad).toFixed(2)} €</td>
        </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Confirmación de pedido</title></head>
<body style="font-family:sans-serif;color:#3D2018;background:#fff;margin:0;padding:0">
  <div style="max-width:600px;margin:30px auto;border:1px solid #f0e8e6;border-radius:8px;overflow:hidden">
    <div style="background:#C4857A;padding:20px 30px">
      <h1 style="color:#fff;margin:0;font-size:20px">✅ Tu pedido está confirmado</h1>
    </div>
    <div style="padding:24px 30px">
      <p style="margin:0 0 16px">Hola <strong>${p.nombre}</strong>, gracias por confiar en <strong>Esencia de Belleza</strong>. Tu pedido ya está confirmado y lo estamos preparando con mucho cuidado.</p>
      <p style="margin:0 0 16px"><strong>Número de pedido:</strong> #${p.pedidoId.slice(0, 8).toUpperCase()}</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead>
          <tr style="background:#fdf5f4">
            <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #C4857A">Producto</th>
            <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #C4857A">Uds.</th>
            <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #C4857A">Subtotal</th>
          </tr>
        </thead>
        <tbody>${lineasHtml}</tbody>
      </table>

      <p style="text-align:right;margin:4px 0"><strong>Envío:</strong> ${p.gastoEnvio > 0 ? `${p.gastoEnvio.toFixed(2)} €` : "Gratuito"}</p>
      ${(p.descuento ?? 0) > 0 ? `<p style="text-align:right;margin:4px 0;color:#16a34a"><strong>Descuento${p.codigoCupon ? ` (${p.codigoCupon})` : ""}:</strong> −${p.descuento!.toFixed(2)} €</p>` : ""}
      <p style="text-align:right;margin:4px 0;font-size:18px"><strong>Total:</strong> ${p.total.toFixed(2)} €</p>

      <div style="margin-top:24px;padding:16px 20px;background:#fdf5f4;border-radius:6px;text-align:center">
        <p style="margin:0 0 8px;font-size:15px;color:#3D2018"><strong>📦 Tu pedido llegará en 24–48 h laborables</strong></p>
        <p style="margin:0;font-size:13px;color:#888">Te enviaremos un email con el número de seguimiento cuando salga de nuestro almacén.</p>
      </div>
      <p style="margin-top:20px;font-size:13px;color:#888;text-align:center">Para cualquier consulta escríbenos a <a href="mailto:${FROM_EMAIL}" style="color:#C4857A">${FROM_EMAIL}</a> o llámanos al <strong>622 004 408</strong>.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const transporter = createTransport();
    await transporter.sendMail({
      from:    `"Esencia de Belleza" <${FROM_EMAIL}>`,
      to:      p.email,
      subject: `✅ ¡Gracias por tu pedido! #${p.pedidoId.slice(0, 8).toUpperCase()} — Esencia de Belleza`,
      html,
    });
  } catch (err) {
    console.error("[Email] Error enviando confirmación al cliente:", err);
  }
}

// ── Notificación de nuevo profesional registrado ─────────────────────────────
export async function enviarNotificacionNuevoProfesional(p: {
  email: string;
  nombre: string;
  empresa: string | null;
  nif_cif: string | null;
  telefono: string | null;
  telefono_contacto: string | null;
  tipo_negocio: string | null;
  direccion_envio: { calle: string; cp: string; ciudad: string; provincia: string } | null;
}) {
  if (!process.env.EMAIL_PASS) {
    console.warn("[Email] EMAIL_PASS no configurado, saltando notificación");
    return;
  }

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Nuevo profesional registrado</title></head>
<body style="font-family:sans-serif;color:#3D2018;background:#fff;margin:0;padding:0">
  <div style="max-width:600px;margin:30px auto;border:1px solid #f0e8e6;border-radius:8px;overflow:hidden">
    <div style="background:#C4857A;padding:20px 30px">
      <h1 style="color:#fff;margin:0;font-size:20px">👩‍🎨 Nuevo profesional registrado</h1>
    </div>
    <div style="padding:24px 30px">
      <p style="margin:0 0 16px">Se ha registrado un nuevo profesional y está pendiente de aprobación:</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tbody>
          <tr><td style="padding:6px 0;font-weight:bold">Nombre</td><td style="padding:6px 0">${p.nombre}</td></tr>
          <tr><td style="padding:6px 0;font-weight:bold">Email</td><td style="padding:6px 0">${p.email}</td></tr>
          ${p.empresa ? `<tr><td style="padding:6px 0;font-weight:bold">Empresa</td><td style="padding:6px 0">${p.empresa}</td></tr>` : ""}
          ${p.nif_cif ? `<tr><td style="padding:6px 0;font-weight:bold">NIF/CIF</td><td style="padding:6px 0">${p.nif_cif}</td></tr>` : ""}
          ${p.telefono_contacto ? `<tr><td style="padding:6px 0;font-weight:bold">Tel. contacto</td><td style="padding:6px 0">${p.telefono_contacto}</td></tr>` : ""}
          ${p.telefono ? `<tr><td style="padding:6px 0;font-weight:bold">Tel. negocio</td><td style="padding:6px 0">${p.telefono}</td></tr>` : ""}
          ${p.tipo_negocio ? `<tr><td style="padding:6px 0;font-weight:bold">Tipo</td><td style="padding:6px 0">${p.tipo_negocio}</td></tr>` : ""}
          ${p.direccion_envio ? `<tr><td style="padding:6px 0;font-weight:bold">Dirección</td><td style="padding:6px 0">${p.direccion_envio.calle}, ${p.direccion_envio.cp} ${p.direccion_envio.ciudad} (${p.direccion_envio.provincia})</td></tr>` : ""}
        </tbody>
      </table>
      <div style="margin-top:24px;text-align:center">
        <a href="https://esenciadebelleza.es/admin/profesionales" style="background:#C4857A;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-size:14px">Revisar en el panel</a>
      </div>
    </div>
  </div>
</body>
</html>`;

  try {
    const transporter = createTransport();
    await transporter.sendMail({
      from:    `"Esencia de Belleza" <${FROM_EMAIL}>`,
      to:      ADMIN_EMAILS,
      subject: `👩‍🎨 Nuevo profesional pendiente — ${p.nombre}${p.empresa ? ` (${p.empresa})` : ""}`,
      html,
    });
  } catch (err) {
    console.error("[Email] Error enviando notificación de profesional:", err);
  }
}
