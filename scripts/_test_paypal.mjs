import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const getEnv = (key) => {
  const m = env.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
};

const clientId = getEnv('NEXT_PUBLIC_PAYPAL_CLIENT_ID');
const secret = getEnv('PAYPAL_SECRET_KEY');

console.log('Client ID:', clientId ? clientId.slice(0, 20) + '...' : 'EMPTY');
console.log('Secret:', secret ? secret.slice(0, 10) + '...' : 'EMPTY');

// Test PayPal OAuth to verify credentials work
const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
const resp = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${auth}`,
  },
  body: 'grant_type=client_credentials',
});

const data = await resp.json();
if (data.access_token) {
  console.log('\n✅ PayPal credentials are VALID');
  console.log('Token type:', data.token_type);
  console.log('Scope:', data.scope);
  console.log('Expires in:', data.expires_in, 'seconds');
} else {
  console.log('\n❌ PayPal credentials are INVALID');
  console.log('Error:', data.error);
  console.log('Description:', data.error_description);
}
