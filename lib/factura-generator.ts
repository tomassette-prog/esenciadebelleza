// ── Generador de facturas HTML para Esencia de Belleza ─────────────────────
// Genera HTML imprimible (Ctrl+P → Guardar como PDF) sin dependencias extra.

export interface LineaFactura {
  nombre: string;
  variacion?: string;
  sku: string;
  cantidad: number;
  precio_unitario: number; // IVA incluido
  subtotal: number;        // IVA incluido
}

export interface DatosFactura {
  // Numeración
  numero: string;          // ej: "EB-2026-00001"
  fecha: string;           // ISO date
  fechaVencimiento?: string;

  // Empresa emisora
  empresa: {
    nombre: string;
    nif: string;
    direccion: string;
    cp: string;
    ciudad: string;
    provincia: string;
    telefono: string;
    email: string;
    web: string;
  };

  // Cliente
  cliente: {
    nombre: string;
    apellidos?: string;
    empresa?: string;
    nif_cif?: string;
    direccion: string;
    cp: string;
    ciudad: string;
    provincia: string;
    email: string;
    telefono?: string;
  };

  // Pedido
  pedidoId: string;
  metodoPago: string;

  // Líneas
  lineas: LineaFactura[];

  // Importes (todos IVA incluido)
  subtotal: number;        // suma de líneas
  descuento: number;
  gastosEnvio: number;
  total: number;           // lo que paga el cliente

  // IVA
  tipoIva?: number;        // default 21

  // Logo (URL absoluta al logo SVG)
  logoUrl?: string;
}

const IVA_DEFAULT = 21;
const LOGO_DEFAULT = "https://esenciadebelleza.es/logo.png";

function euros(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

function fechaLegible(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function desgloseIva(importeConIva: number, tipoIva: number) {
  const base = importeConIva / (1 + tipoIva / 100);
  const cuota = importeConIva - base;
  return { base, cuota };
}

/**
 * Genera el HTML completo de una factura.
 * Imprimible con Ctrl+P desde el navegador → Guardar como PDF.
 */
export function generarHtmlFactura(datos: DatosFactura): string {
  const tipoIva = datos.tipoIva ?? IVA_DEFAULT;
  const { base: baseImponible, cuota: cuotaIva } = desgloseIva(
    datos.total,
    tipoIva
  );

  const lineasHtml = datos.lineas
    .map(
      (l) => {
        // Precios sin IVA para mostrar en tabla (factura oficial)
        const precioSinIva = l.precio_unitario / (1 + tipoIva / 100);
        const subtotalSinIva = l.subtotal / (1 + tipoIva / 100);
        return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e8e0dc">
          <div style="font-weight:600;color:#3D2018">${l.nombre}</div>
          ${l.variacion ? `<div style="font-size:12px;color:#888;margin-top:2">${l.variacion}</div>` : ""}
          <div style="font-size:11px;color:#aaa;margin-top:2">SKU: ${l.sku}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e8e0dc;text-align:center;color:#3D2018">
          ${l.cantidad}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e8e0dc;text-align:right;color:#3D2018">
          ${euros(precioSinIva)}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e8e0dc;text-align:right;font-weight:600;color:#3D2018">
          ${euros(subtotalSinIva)}
        </td>
      </tr>`;
      }
    )
    .join("");

  const clienteNombre = datos.cliente.empresa
    ? datos.cliente.empresa
    : `${datos.cliente.nombre} ${datos.cliente.apellidos ?? ""}`.trim();

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura ${datos.numero} — Esencia de Belleza</title>
  <style>
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
      @page { margin: 15mm; size: A4; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #3D2018;
      background: #fff;
      line-height: 1.5;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
  </style>
</head>
<body>

  <!-- Botón imprimir (solo en pantalla) -->
  <div class="no-print" style="text-align:right;margin-bottom:20px">
    <button onclick="window.print()"
      style="background:#C4857A;color:#fff;border:none;padding:10px 24px;border-radius:6px;cursor:pointer;font-size:14px">
      🖨️ Imprimir / Guardar PDF
    </button>
  </div>

  <!-- Cabecera -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px">
    <div>
      ${datos.logoUrl ?? LOGO_DEFAULT ? `<img src="${datos.logoUrl ?? LOGO_DEFAULT}" alt="Esencia de Belleza" style="height:80px;margin-bottom:8px;border-radius:4px" />` : ""}
      <h1 style="font-size:28px;color:#C4857A;margin-bottom:4px;font-weight:800;letter-spacing:-0.5px">
        ESENCIA DE BELLEZA
      </h1>
      <p style="font-size:12px;color:#888;letter-spacing:2px;text-transform:uppercase">
        Distribución profesional de estética y peluquería
      </p>
    </div>
    <div style="text-align:right">
      <div style="background:#C4857A;color:#fff;display:inline-block;padding:8px 20px;border-radius:4px;font-size:20px;font-weight:700;letter-spacing:1px">
        FACTURA
      </div>
      <div style="margin-top:10px;font-size:14px;color:#555">
        <strong>${datos.numero}</strong>
      </div>
    </div>
  </div>

  <!-- Datos emisor y cliente -->
  <div style="display:flex;gap:40px;margin-bottom:32px">
    <!-- Emisor -->
    <div style="flex:1;background:#fdf5f4;padding:20px;border-radius:8px;border:1px solid #f0e8e6">
      <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#C4857A;margin-bottom:10px">
        Datos del emisor
      </h3>
      <p style="font-weight:700;font-size:15px;margin-bottom:6px">${datos.empresa.nombre}</p>
      <p style="font-size:13px;color:#555">NIF: ${datos.empresa.nif}</p>
      <p style="font-size:13px;color:#555">${datos.empresa.direccion}</p>
      <p style="font-size:13px;color:#555">${datos.empresa.cp} ${datos.empresa.ciudad} (${datos.empresa.provincia})</p>
      <p style="font-size:13px;color:#555;margin-top:6px">📧 ${datos.empresa.email}</p>
      <p style="font-size:13px;color:#555">📞 ${datos.empresa.telefono}</p>
      <p style="font-size:13px;color:#555">🌐 ${datos.empresa.web}</p>
    </div>

    <!-- Cliente -->
    <div style="flex:1;background:#fdf5f4;padding:20px;border-radius:8px;border:1px solid #f0e8e6">
      <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#C4857A;margin-bottom:10px">
        Facturar a
      </h3>
      <p style="font-weight:700;font-size:15px;margin-bottom:6px">${clienteNombre}</p>
      ${datos.cliente.nif_cif ? `<p style="font-size:13px;color:#555">${datos.cliente.nif_cif}</p>` : ""}
      <p style="font-size:13px;color:#555">${datos.cliente.direccion}</p>
      <p style="font-size:13px;color:#555">${datos.cliente.cp} ${datos.cliente.ciudad} (${datos.cliente.provincia})</p>
      <p style="font-size:13px;color:#555;margin-top:6px">📧 ${datos.cliente.email}</p>
      ${datos.cliente.telefono ? `<p style="font-size:13px;color:#555">📞 ${datos.cliente.telefono}</p>` : ""}
    </div>
  </div>

  <!-- Metadatos -->
  <div style="display:flex;gap:24px;margin-bottom:28px;padding:14px 20px;background:#f9f5f3;border-radius:6px">
    <div>
      <span style="font-size:11px;text-transform:uppercase;color:#888;letter-spacing:1px">Fecha</span>
      <p style="font-size:14px;font-weight:600">${fechaLegible(datos.fecha)}</p>
    </div>
    <div>
      <span style="font-size:11px;text-transform:uppercase;color:#888;letter-spacing:1px">Pedido</span>
      <p style="font-size:14px;font-weight:600">#${datos.pedidoId.slice(0, 8).toUpperCase()}</p>
    </div>
    <div>
      <span style="font-size:11px;text-transform:uppercase;color:#888;letter-spacing:1px">Método de pago</span>
      <p style="font-size:14px;font-weight:600">${datos.metodoPago}</p>
    </div>
  </div>

  <!-- Tabla de productos -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
    <thead>
      <tr style="background:#C4857A">
        <th style="padding:10px 12px;text-align:left;color:#fff;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;border-radius:6px 0 0 0">
          Producto
        </th>
        <th style="padding:10px 12px;text-align:center;color:#fff;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">
          Uds.
        </th>
        <th style="padding:10px 12px;text-align:right;color:#fff;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">
          Precio (sin IVA)
        </th>
        <th style="padding:10px 12px;text-align:right;color:#fff;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;border-radius:0 6px 0 0">
          Total (sin IVA)
        </th>
      </tr>
    </thead>
    <tbody>
      ${lineasHtml}
    </tbody>
  </table>

  <!-- Resumen de importes -->
  <div style="display:flex;justify-content:flex-end">
    <div style="width:320px">
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e8e0dc">
        <span style="color:#888">Base imponible</span>
        <span>${euros(baseImponible)}</span>
      </div>
      ${
        datos.descuento > 0
          ? `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e8e0dc;color:#16a34a">
              <span>Descuento</span>
              <span>−${euros(datos.descuento)}</span>
            </div>`
          : ""
      }
      ${
        datos.gastosEnvio > 0
          ? `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e8e0dc">
              <span style="color:#888">Gastos de envío</span>
              <span>${euros(datos.gastosEnvio)}</span>
            </div>`
          : `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e8e0dc">
              <span style="color:#888">Gastos de envío</span>
              <span style="color:#16a34a">Gratuito</span>
            </div>`
      }

      <!-- Desglose IVA -->
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e8e0dc;font-size:13px;color:#888">
        <span>Cuota IVA (${tipoIva}%)</span>
        <span>${euros(cuotaIva)}</span>
      </div>

      <!-- Total -->
      <div style="display:flex;justify-content:space-between;padding:14px 0;margin-top:8px;background:#C4857A;color:#fff;border-radius:6px;padding-left:16px;padding-right:16px">
        <span style="font-size:16px;font-weight:700">TOTAL</span>
        <span style="font-size:18px;font-weight:800">${euros(datos.total)}</span>
      </div>
    </div>
  </div>

  <!-- Nota legal -->
  <div style="margin-top:48px;padding-top:20px;border-top:1px solid #e8e0dc">
    <p style="font-size:11px;color:#aaa;line-height:1.6">
      Esta factura se emite de acuerdo con la normativa fiscal española vigente.
      Los precios incluyen el IVA del ${tipoIva}%. El pago de esta factura se realizó
      a través de ${datos.metodoPago}. Conservar esta factura para su contabilidad.
    </p>
    <p style="font-size:11px;color:#aaa;margin-top:8px">
      ${datos.empresa.nombre} · ${datos.empresa.nif} · ${datos.empresa.direccion}, ${datos.empresa.cp} ${datos.empresa.ciudad} (${datos.empresa.provincia})
    </p>
  </div>

  <!-- Protección de datos -->
  <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e8e0dc">
    <p style="font-size:10px;color:#bbb;line-height:1.5">
      ESENCIA DE BELLEZA, con el domicilio arriba indicado, de acuerdo con lo establecido en el Reglamento General de Protección de Datos de la Unión Europea (GDPR) le informa que los datos personales que nos ha facilitado serán incorporados a un fichero automatizado y alojados en un servidor seguro titularidad de esta empresa a fin de contactar con Vd. para formalizar la compra, el envío, facturación, y remitirle información comercial de nuestros productos y servicios. En ningún caso serán cedidos a terceros, y podrá ejercitar sus derechos de acceso, rectificación, limitación, supresión, portabilidad y oposición a su tratamiento comunicándolo a la dirección postal arriba indicada o por e-mail a nuestra dirección: info@esenciadebelleza.es
    </p>
  </div>

</body>
</html>`;
}

/**
 * Genera los datos de una factura a partir de un pedido de Supabase.
 */
export function pedidoAFactura(pedido: {
  id: string;
  created_at: string;
  email_cliente: string;
  direccion_envio: Record<string, string>;
  metodo_pago: string | null;
  subtotal: number;
  descuento_cupon?: number;
  descuento?: number;
  gastos_envio: number;
  total: number;
  pedidos_lineas: Array<{
    nombre_producto: string;
    nombre_variacion: string | null;
    sku: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }>;
  facturacion?: {
    empresa?: string;
    nif_cif?: string;
    direccion?: string;
    ciudad?: string;
    provincia?: string;
    codigo_postal?: string;
  } | null;
}): DatosFactura {
  const dir = pedido.direccion_envio ?? {};
  const fac = pedido.facturacion;

  // Generar número de factura secuencial basado en fecha
  const fecha = new Date(pedido.created_at);
  const anio = fecha.getFullYear();
  const numCorto = pedido.id.slice(0, 5).toUpperCase();
  const numero = `EB-${anio}-${numCorto}`;

  const metodoPagoLegible: Record<string, string> = {
    stripe: "Tarjeta (Stripe)",
    paypal: "PayPal",
    bizum: "Bizum",
    contrareembolso: "Contra reembolso",
    tarjeta: "Tarjeta",
  };

  return {
    numero,
    fecha: pedido.created_at,
    empresa: {
      nombre: "Sandra Navarro Torres",
      nif: "44871676X",
      direccion: "C/ Torero Antonio Carpio, 13-12",
      cp: "46470",
      ciudad: "Catarroja",
      provincia: "Valencia",
      telefono: "622 004 408",
      email: "info@esenciadebelleza.es",
      web: "esenciadebelleza.es",
    },
    cliente: {
      nombre: dir.nombre ?? "",
      apellidos: dir.apellidos ?? "",
      empresa: fac?.empresa ?? undefined,
      nif_cif: fac?.nif_cif ?? undefined,
      direccion: fac?.direccion ?? dir.direccion ?? "",
      cp: fac?.codigo_postal ?? dir.codigo_postal ?? "",
      ciudad: fac?.ciudad ?? dir.ciudad ?? "",
      provincia: fac?.provincia ?? dir.provincia ?? "",
      email: pedido.email_cliente,
      telefono: dir.telefono,
    },
    pedidoId: pedido.id,
    metodoPago: metodoPagoLegible[pedido.metodo_pago ?? ""] ?? pedido.metodo_pago ?? "—",
    lineas: pedido.pedidos_lineas.map((l) => ({
      nombre: l.nombre_producto,
      variacion: l.nombre_variacion ?? undefined,
      sku: l.sku,
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
      subtotal: l.subtotal,
    })),
    subtotal: pedido.subtotal,
    descuento: pedido.descuento_cupon ?? pedido.descuento ?? 0,
    gastosEnvio: pedido.gastos_envio,
    total: pedido.total,
  };
}
