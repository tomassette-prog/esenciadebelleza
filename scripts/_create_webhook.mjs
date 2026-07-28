import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const getEnv = (key) => {
  const m = env.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
};

const STRIPE_KEY = getEnv('STRIPE_SECRET_KEY');

// Create webhook endpoint via Stripe API
const resp = await fetch('https://api.stripe.com/v1/webhook_endpoints', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${STRIPE_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    'url': 'https://esenciadebelleza.es/api/webhooks/stripe',
    'enabled_events[]': 'checkout.session.completed',
    'enabled_events[]': 'checkout.session.expired',
    'description': 'Esencia de Belleza - Checkout confirmation',
  }),
});

const data = await resp.json();
if (data.error) {
  console.error('ERROR:', JSON.stringify(data.error, null, 2));
} else {
  console.log('Webhook created successfully!');
  console.log('ID:', data.id);
  console.log('URL:', data.url);
  console.log('Secret:', data.secret);
  console.log('Events:', data.enabled_events);
  console.log('\n--- IMPORTANT ---');
  console.log('Copy this secret to Vercel STRIPE_WEBHOOK_SECRET:');
  console.log(data.secret);
}
