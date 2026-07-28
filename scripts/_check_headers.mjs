import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const getEnv = (key) => {
  const m = env.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
};

const testUrl = 'https://depeluqueriaproductos.com/';
console.log('Testing iframe headers on:', testUrl);

const resp = await fetch(testUrl, { method: 'HEAD' });
const csp = resp.headers.get('content-security-policy');
const xfo = resp.headers.get('x-frame-options');

console.log('Content-Security-Policy:', csp || 'NOT SET');
console.log('X-Frame-Options:', xfo || 'NOT SET');

if (csp && csp.includes('frame-ancestors')) {
  console.log('\n✅ frame-ancestors already configured:', csp);
} else {
  console.log('\n⚠️  frame-ancestors NOT configured. Need to add it.');
  console.log('\nCurrent CSP:', csp || 'none');
}
