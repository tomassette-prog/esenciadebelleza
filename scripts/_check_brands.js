const fs = require('fs');
const https = require('https');

const envContent = fs.readFileSync('.env.production.local', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.+)/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1]] = val;
  }
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing credentials');
  process.exit(1);
}

const urlObj = new URL(url + '/rest/v1/marcas?select=id,nombre&limit=5');
const req = https.request({
  hostname: urlObj.hostname,
  path: urlObj.pathname + urlObj.search,
  method: 'GET',
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json'
  }
}, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', data.substring(0, 500));
  });
});

req.on('error', e => console.error('Error:', e.message));
req.end();
