const https = require('https');

const projectId = 'esenciadebelleza';
const teamId = 'tomassette-progs-projects';
const variableName = 'SUPABASE_SERVICE_ROLE_KEY';
const variableValue = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqYW5vYnNmemN3cHVzeW52bHVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTY5NzE3OCwiZXhwIjoyMDk3MjczMTc4fQ.Ph7vXLcfU4Dv3YJ3jzcIOnehn9v_x0FvDMjtyDfkse8';
const token = process.env.VERCEL_TOKEN;

if (!token) {
  console.error('❌ VERCEL_TOKEN not set');
  process.exit(1);
}

const data = JSON.stringify({
  key: variableName,
  value: variableValue,
  target: ['production'],
});

const options = {
  hostname: 'api.vercel.com',
  path: `/v8/projects/${projectId}/env?teamId=${teamId}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Authorization': `Bearer ${token}`,
  },
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ Variable agregada a Production');
      console.log(body);
    } else {
      console.error(`❌ Error ${res.statusCode}:`);
      console.error(body);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});

req.write(data);
req.end();
