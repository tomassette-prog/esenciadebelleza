import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const getEnv = (key) => {
  const m = env.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
};

const CK = getEnv('WOO_CONSUMER_KEY');
const CS = getEnv('WOO_CONSUMER_SECRET');
const WOO_URL = getEnv('WOO_URL');

if (!CK || !CS || !WOO_URL) {
  console.log('WooCommerce credentials not available locally');
  process.exit(0);
}

const auth = Buffer.from(`${CK}:${CS}`).toString('base64');

// Get payment gateway settings
const resp = await fetch(`${WOO_URL}/wp-json/wc/v3/settings/payment/cecabank`, {
  headers: { Authorization: `Basic ${auth}` },
});
if (resp.ok) {
  const data = await resp.json();
  const keys = data.filter(s => s.id && (s.id.includes('merchant') || s.id.includes('acquirer') || s.id.includes('terminal') || s.id.includes('secret')));
  for (const k of keys) {
    console.log(`${k.id}: ${k.value || '(empty)'}`);
  }
} else {
  console.log('Error:', resp.status);
  // Try stripe
  const resp2 = await fetch(`${WOO_URL}/wp-json/wc/v3/settings/payment/stripe`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (resp2.ok) {
    const data = await resp2.json();
    const keys = data.filter(s => s.id && (s.id.includes('key') || s.id.includes('secret')));
    for (const k of keys) {
      console.log(`[stripe] ${k.id}: ${k.value ? k.value.slice(0, 15) + '...' : '(empty)'}`);
    }
  }
}
