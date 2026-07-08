// Script para hacer test directo de la Server Action
import fetch from 'node-fetch';

const BASE_URL = 'https://esenciadebelleza.es';

// Datos de prueba - 2 productos
const productsData = [
  {
    productoId: '1001',
    nombre: 'Champú Hidratante Premium',
    descripcionActual: 'Champú de limpieza suave',
    queAgregar: 'Contiene proteínas de seda hidratantes'
  },
  {
    productoId: '1002',
    nombre: 'Acondicionador Reparador',
    descripcionActual: 'Acondicionador reparador intenso',
    queAgregar: 'Ideal para cabello dañado y seco'
  }
];

async function testServerAction() {
  console.log('📝 Test de Server Action: procesarLoteGoogleMerchant');
  console.log(`URL: ${BASE_URL}`);
  console.log(`Productos a procesar: ${productsData.length}`);
  console.log('');

  try {
    // Intenta hacer un llamado simple primero
    console.log('1. Verificando conectividad...');
    const response = await fetch(`${BASE_URL}/api`);
    console.log(`✅ Conectividad OK (status: ${response.status})`);

    // Ahora intenta hacer fetch a la acción
    console.log('\n2. Intentando llamar Server Action...');
    
    // Nota: Las Server Actions no se pueden llamar directamente via fetch
    // Necesitamos hacer POST a la misma URL con forma especial
    // O podemos hacer POST a un endpoint API que las llame
    
    console.log('ℹ️  Server Actions no son directamente accesibles via fetch.');
    console.log('   Se deben llamar desde un componente Client o desde un formulario.');
    console.log('   El test real debe hacerse desde la interfaz del navegador.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testServerAction();
