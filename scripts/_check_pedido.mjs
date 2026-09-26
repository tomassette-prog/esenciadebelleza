import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Load .env.local
try {
  const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch {}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const id = process.argv[2] || "3AE58D04";

// Buscar pedido
const { data: pedidos, error } = await supabase
  .from("pedidos")
  .select("id, estado, total, subtotal, gastos_envio, metodo_pago, stripe_payment_id, email_cliente, direccion_envio, created_at, woo_order_id")
  .ilike("id", `%${id}%`);

if (error) {
  console.error("Error buscando pedido:", error.message);
  process.exit(1);
}

if (!pedidos || pedidos.length === 0) {
  console.log("No se encontró ningún pedido con ese ID");
  process.exit(0);
}

for (const pedido of pedidos) {
  console.log("\n=== PEDIDO ===");
  console.log("ID:", pedido.id);
  console.log("Estado:", pedido.estado);
  console.log("Total:", pedido.total);
  console.log("Subtotal:", pedido.subtotal);
  console.log("Envío:", pedido.gastos_envio);
  console.log("Método:", pedido.metodo_pago);
  console.log("Stripe ref:", pedido.stripe_payment_id);
  console.log("Email:", pedido.email_cliente);
  console.log("Woo ID:", pedido.woo_order_id);
  console.log("Fecha:", pedido.created_at);
  const dir = pedido.direccion_envio || {};
  console.log("Cliente:", dir.nombre, dir.apellidos);

  // Buscar líneas
  const { data: lineas } = await supabase
    .from("pedidos_lineas")
    .select("id, sku, nombre_producto, nombre_variacion, cantidad, precio_unitario, subtotal, variacion_id")
    .eq("pedido_id", pedido.id);

  console.log("\n=== LÍNEAS === (" + (lineas?.length ?? 0) + ")");
  if (lineas && lineas.length > 0) {
    for (const l of lineas) {
      console.log(`  [${l.sku}] ${l.nombre_producto}${l.nombre_variacion ? " — " + l.nombre_variacion : ""} x${l.cantidad} @ ${l.precio_unitario}€ = ${l.subtotal}€`);
    }
  } else {
    console.log("  ⚠️ SIN LÍNEAS DE PRODUCTO");
  }
}
