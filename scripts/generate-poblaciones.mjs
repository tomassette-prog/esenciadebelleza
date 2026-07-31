import https from 'https';
import fs from 'fs';

const url = 'https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/29005?tip=AM&nult=1';

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

const provinceMap = {
  '04':'Almería','33':'Asturias','05':'Ávila','06':'Badajoz',
  '07':'Baleares','08':'Barcelona','48':'Vizcaya','09':'Burgos',
  '10':'Cáceres','11':'Cádiz','39':'Cantabria','12':'Castellón',
  '13':'Ciudad Real','14':'Córdoba','15':'La Coruña','16':'Cuenca',
  '17':'Girona','18':'Granada','19':'Guadalajara','20':'Guipúzcoa',
  '21':'Huelva','22':'Huesca','23':'Jaén','24':'León',
  '25':'Lleida','27':'Lugo','28':'Madrid','29':'Málaga',
  '30':'Murcia','31':'Navarra','32':'Ourense','34':'Palencia',
  '36':'Pontevedra','37':'Salamanca',
  '40':'Segovia','41':'Sevilla',
  '42':'Soria','43':'Tarragona','44':'Teruel','45':'Toledo',
  '46':'Valencia','47':'Valladolid','49':'Zamora','50':'Zaragoza',
  '01':'Álava','02':'Albacete','03':'Alicante','26':'La Rioja'
};

async function main() {
  console.log('Fetching INE data...');
  const raw = await fetch(url);
  const parsed = JSON.parse(raw);
  console.log('Total items:', parsed.length);

  const municipiosByProv = {};
  
  for (const item of parsed) {
    const meta = item.MetaData?.find(m => m.T3_Variable === 'Municipios');
    if (!meta) continue;
    const code = meta.Codigo;
    const name = meta.Nombre;
    const provCode = code.substring(0, 2);
    const provName = provinceMap[provCode];
    if (!provName) continue;
    if (!municipiosByProv[provName]) municipiosByProv[provName] = new Set();
    municipiosByProv[provName].add(name);
  }

  const result = {};
  for (const [prov, munis] of Object.entries(municipiosByProv)) {
    result[prov] = [...munis].sort((a, b) => a.localeCompare(b, 'es'));
  }

  let output = '// Poblaciones oficiales por provincia — datos del INE (Padrón Municipal)\n';
  output += '// Generado automáticamente con scripts/generate-poblaciones.mjs\n\n';
  output += 'export const POBLACIONES: Record<string, string[]> = {\n';
  
  const sortedProvs = Object.keys(result).sort((a, b) => a.localeCompare(b, 'es'));
  for (const prov of sortedProvs) {
    const munis = result[prov];
    output += `  "${prov}": [\n`;
    let line = '    ';
    for (let i = 0; i < munis.length; i++) {
      const entry = `"${munis[i]}"`;
      if (line.length + entry.length + 2 > 120) {
        output += line.trimEnd() + ',\n';
        line = '    ' + entry;
      } else {
        line += (line.trim() ? ',' : '') + entry;
      }
    }
    if (line.trim()) output += line + '\n';
    output += '  ],\n';
  }
  output += '};\n';

  fs.writeFileSync('lib/poblaciones.ts', output, 'utf8');
  
  console.log(`Done! ${sortedProvs.length} provinces, ${Object.values(result).reduce((s, a) => s + a.length, 0)} municipalities`);
  for (const p of sortedProvs) {
    console.log(`  ${p}: ${result[p].length}`);
  }
}

main().catch(console.error);
