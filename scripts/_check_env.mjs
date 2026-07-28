import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const lines = env.split('\n').filter(l => l.trim() && !l.startsWith('#'));
for (const l of lines) {
  const idx = l.indexOf('=');
  if (idx === -1) continue;
  const key = l.slice(0, idx);
  const val = l.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  console.log(key + ' = ' + (val ? '[SET len=' + val.length + ']' : '[EMPTY]'));
}
