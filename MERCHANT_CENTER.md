# Sistema Automático de Enriquecimiento de Productos - Google Merchant Center

Sistema que automatiza la corrección de productos que Google Merchant Center reporta como incompletos.

## 🎯 ¿Qué hace?

Cuando Google Merchant Center te dice que faltan descripciones o datos en productos:

1. **Descargas el CSV** desde Google Merchant Center (reporte de errores)
2. **Lo subes al panel admin** (nueva sección "Google Merchant Center")
3. **El sistema automáticamente**:
   - Identifica productos sin descripción
   - Genera descripciones enriquecidas con IA (Fórmula, Ingrediente, Beneficios)
   - Actualiza Supabase
   - Te muestra el resultado

## 📋 Instalación

```bash
npm install
npm run build
```

Las dependencias ya están agregadas:
- `csv-parse` - para procesar CSVs
- `@anthropic-ai/sdk` - para generar descripciones con Claude

## 🚀 Uso

### Opción 1: Desde el Panel Admin (Recomendado)

1. Ve a `https://esenciadebelleza.es/admin/merchant-center`
2. Sube el CSV descargado de Google Merchant Center
3. El sistema procesa automáticamente

### Opción 2: Desde Terminal

```bash
npm run merchant:fix -- --file="./descargas/google-merchant-errors.csv"
```

Genera un log con los cambios realizados.

## 📊 CSV esperado

Google Merchant Center exporta un CSV con estas columnas:

```
Producto,ID de producto,Idioma,Etiqueta de feed,Descripción,Datos importantes,Añadir a la descripción
CHAMPU NATURA TOMILLO 500ML,8037693002580186036,es,ES,,,"Fórmula, Ingrediente, Beneficios"
```

El sistema busca productos donde:
- `Descripción` está vacía
- `Añadir a la descripción` indica qué campos faltan

## 🔧 Cómo funciona

### 1. Parseo del CSV
- Lee archivo CSV (UTF-16LE por defecto, fallback a UTF-8)
- Extrae productos incompletos

### 2. Generación con IA
- Usa Claude Sonnet para generar descripciones
- Prompt específico: "Fórmula, Ingrediente, Beneficios"
- Genera texto profesional y conciso

### 3. Actualización
- Busca producto en Supabase por nombre o woo_id
- Combina descripción existente con la nueva
- Guarda timestamp de actualización

### 4. Resultados
- Muestra éxito/fallo por producto
- Guarda log en `merchant-center-fix-TIMESTAMP.log`

## 📝 Log de cambios

Cada ejecución genera un archivo:
```
merchant-center-fix-2026-07-03-17-43-39.log
```

Con este contenido:
```json
{
  "fecha": "2026-07-03T17:43:39.000Z",
  "archivo": "./descargas/google-merchant.csv",
  "totalProcesados": 8,
  "exitosos": 7,
  "fallidos": 1,
  "detalles": [...]
}
```

## ⚙️ Variables de entorno

Necesitas estas en `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://yjanobsfzcwpusynvlun.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=sk-ant-...
```

## 🔄 Flujo completo

```
Google Merchant Center
        ↓
Descargas CSV con errores
        ↓
Lo subes a /admin/merchant-center
        ↓
Sistema procesa automáticamente
        ↓
Claude genera descripciones (Fórmula, Ingrediente, Beneficios)
        ↓
Actualiza Supabase
        ↓
Resultado mostrado en panel
        ↓
(Opcional) Sincroniza con WooCommerce
        ↓
Google Merchant Center valida cambios
```

## 🎓 Ejemplo: Cómo ve Claude un producto

**Input:**
```
Producto: LENDAN CHAMPÚ NEUTRAL ALGAS GLYCOLIC 1000ML
Descripción actual: (vacía)
Qué agregar: Fórmula, Ingrediente, Beneficios
```

**Output de Claude:**
```
Champú neutro con algas y ácido glicólico. 
Fórmula: Combinación de agentes limpiadores suaves con extracto de algas marinas.
Ingrediente: Ácido glicólico que exfolia y renueva el cuero cabelludo.
Beneficios: Limpieza profunda, renovación celular, cabello suave y brillante.
```

## 🐛 Troubleshooting

### "Producto no encontrado en BD"
- Verifica que el nombre en Google coincida exactamente con Supabase
- El sistema busca por `nombre` o `woo_id`

### "Error de IA"
- Verifica que `ANTHROPIC_API_KEY` sea válido
- Comprueba límites de API de Anthropic

### "No se encontraron productos incompletos"
- Todos los productos del CSV tienen descripción
- La columna "Añadir a la descripción" está vacía

## 📚 Archivos relacionados

- `/actions/merchant-center.ts` - Server Actions
- `/scripts/merchant-center-fix.ts` - Script CLI
- `/components/admin/MerchantCenterUpload.tsx` - Componente upload
- `/app/admin/merchant-center/page.tsx` - Página admin

## 🚀 Próximos pasos

- [ ] Webhook de Google Merchant Center para alertas automáticas
- [ ] Sincronización automática con WooCommerce después de enriquecer
- [ ] Historial de cambios en admin
- [ ] Validación de Google Merchant Center desde el panel
