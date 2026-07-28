import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const getEnv = (key) => {
  const match = env.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : '';
};

const SUPA_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPA_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const headers = {
  'apikey': SUPA_KEY,
  'Authorization': `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
};

// 1. Get recent orders
console.log('=== ÚLTIMOS 10 PEDIDOS ===\n');
const resp = await fetch(`${SUPA_URL}/rest/v1/pedidos?select=*&order=created_at.desc&limit=10`, { headers });
const pedidos = await resp.json();

for (const p of pedidos) {
  console.log(`ID: ${p.id}`);
  console.log(`  Fecha: ${p.created_at}`);
  console.log(`  Email: ${p.email}`);
  console.log(`  Total: ${p.total}€`);
  console.log(`  Estado: ${p.estado}`);
  console.log(`  Pago ref: ${p.referencia_pago || p.payment_intent_id || p.stripe_session_id || 'NINGUNA'}`);
  console.log(`  Método pago: ${p.metodo_pago || p.payment_method || 'N/A'}`);
  console.log(`  Enviado: ${p.enviado || false}`);
  console.log('');
}

// 2. Check Stripe checkout sessions (last 3 days)
console.log('=== CHECKOUT SESSIONS RECIENTES (últimos 3 días) ===\n');
const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
const sessResp = await fetch(`${SUPA_URL}/rest/v1/pedidos?select=*&created_at=gte.${threeDaysAgo}&order=created_at.desc`, { headers });
const recentPedidos = await sessResp.json();
console.log(`Pedidos en últimos 3 días: ${recentPedidos.length}`);
for (const p of recentPedidos) {
  console.log(`  ${p.id} | ${p.created_at?.slice(0,16)} | ${p.email} | ${p.total}€ | estado: ${p.estado} | pago: ${p.referencia_pago || p.payment_intent_id || 'N/A'}`);
}
