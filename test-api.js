// Test directo de la Server Action
const csvContent = `Producto,ID de producto,Idioma,Etiqueta de feed,Descripción,Datos importantes,Añadir a la descripción
Champú Hidratante Premium,1001,es,producto,Champú de limpieza suave,Volumen: 250ml,Contiene proteínas de seda hidratantes
Acondicionador Reparador,1002,es,producto,Acondicionador reparador intenso,Volumen: 200ml,Ideal para cabello dañado y seco`;

console.log('CSV Content:');
console.log(csvContent);

// Simula el parsing que hace el component
const lines = csvContent.split('\n');
const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

console.log('\nHeaders detectados:');
console.log(headers);

// Busca columnas importantes
const productColumn = headers.findIndex(h => h.includes('producto'));
const descColumn = headers.findIndex(h => h.includes('descripción'));
const addColumn = headers.findIndex(h => h.includes('añadir'));

console.log('\nColumnas encontradas:');
console.log(`- Producto: ${productColumn} (${headers[productColumn]})`);
console.log(`- Descripción: ${descColumn} (${headers[descColumn]})`);
console.log(`- Añadir: ${addColumn} (${headers[addColumn]})`);

// Parse products
const products = [];
for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  const values = lines[i].split(',').map(v => v.trim());
  products.push({
    nombre: values[productColumn],
    descripcion: values[descColumn],
    queAgregar: values[addColumn]
  });
}

console.log('\nProductos detectados:', products.length);
products.forEach((p, i) => {
  console.log(`${i+1}. ${p.nombre}`);
});
