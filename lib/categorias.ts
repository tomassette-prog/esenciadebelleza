/**
 * lib/categorias.ts
 *
 * Fuente de verdad para la taxonomía de categorías de Esencia de Belleza.
 * Usada por:
 *   - NavMegaMenu (navbar con mega dropdown)
 *   - scripts/import-woo.ts (mapeo WooCommerce → nuestra taxonomía)
 *   - Rutas de producto: /productos/[categoria]/[subcategoria]/[slug]
 *
 * Estructura de URL canónica:
 *   /productos/peluqueria/tintes
 *   /productos/peluqueria/champus
 *   /productos/estetica/cremas-faciales
 *   /productos/barberia/ceras-barbero
 *   /marcas/[slug]
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface NavLink {
  label: string;
  href: string;
}

export interface NavColumna {
  titulo: string;
  links: NavLink[];
}

export interface NavItem {
  label: string;
  href: string;
  columnas?: NavColumna[];
}

// ─── Estructura del Navbar ────────────────────────────────────────────────────

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Peluquería",
    href: "/productos/peluqueria",
    columnas: [
      {
        titulo: "Coloración",
        links: [
          { label: "Tintes", href: "/productos/peluqueria/tintes" },
          { label: "Decoloración", href: "/productos/peluqueria/decoloracion" },
          { label: "Oxigenadas", href: "/productos/peluqueria/oxigenadas" },
          { label: "Sin amoniaco", href: "/productos/peluqueria/sin-amoniaco" },
        ],
      },
      {
        titulo: "Cuidado Capilar",
        links: [
          { label: "Champús", href: "/productos/peluqueria/champus" },
          { label: "Mascarillas", href: "/productos/peluqueria/mascarillas" },
          { label: "Acondicionadores", href: "/productos/peluqueria/acondicionadores" },
          { label: "Ampollas y Sérums", href: "/productos/peluqueria/ampollas-y-serums" },
          { label: "Tratamientos", href: "/productos/peluqueria/tratamientos" },
        ],
      },
      {
        titulo: "Styling",
        links: [
          { label: "Lacas", href: "/productos/peluqueria/lacas" },
          { label: "Espumas", href: "/productos/peluqueria/espumas" },
          { label: "Gominas y Ceras", href: "/productos/peluqueria/gominas-y-ceras" },
          { label: "Rizos y Anticrespo", href: "/productos/peluqueria/rizos" },
          { label: "Permanentes", href: "/productos/peluqueria/permanentes" },
        ],
      },
      {
        titulo: "Equipos y Herramientas",
        links: [
          { label: "Secadores y Planchas", href: "/productos/peluqueria/secadores-y-planchas" },
          { label: "Máquinas de corte", href: "/productos/peluqueria/maquinas-corte" },
          { label: "Cepillos y Peines", href: "/productos/peluqueria/cepillos-y-peines" },
          { label: "Tijeras y Navajas", href: "/productos/peluqueria/tijeras" },
          { label: "Batas y Capas", href: "/productos/peluqueria/batas-y-capas" },
        ],
      },
    ],
  },
  {
    label: "Estética",
    href: "/productos/estetica",
    columnas: [
      {
        titulo: "Facial",
        links: [
          { label: "Cremas faciales", href: "/productos/estetica/cremas-faciales" },
          { label: "Mascarillas faciales", href: "/productos/estetica/mascarillas-faciales" },
          { label: "Sérums y Contorno de ojos", href: "/productos/estetica/serums-faciales" },
          { label: "Gel facial y limpieza", href: "/productos/estetica/gel-facial" },
        ],
      },
      {
        titulo: "Corporal",
        links: [
          { label: "Cremas corporales", href: "/productos/estetica/cremas-corporales" },
          { label: "Aceites corporales", href: "/productos/estetica/aceites-corporales" },
          { label: "Leche corporal", href: "/productos/estetica/leche-corporal" },
          { label: "Peeling y Exfoliantes", href: "/productos/estetica/peeling" },
        ],
      },
      {
        titulo: "Depilación",
        links: [
          { label: "Ceras depiladoras", href: "/productos/estetica/ceras-depiladoras" },
          { label: "Depilatorios", href: "/productos/estetica/depilatorios" },
        ],
      },
      {
        titulo: "Uñas y Maquillaje",
        links: [
          { label: "Manicura y Pedicura", href: "/productos/estetica/manicura-pedicura" },
          { label: "Limas y Fresas", href: "/productos/estetica/unas" },
          { label: "Lámparas UV/LED", href: "/productos/estetica/lamparas-uv" },
          { label: "Maquillaje", href: "/productos/estetica/maquillaje" },
        ],
      },
    ],
  },
  {
    label: "Barbería",
    href: "/productos/barberia",
    columnas: [
      {
        titulo: "Afeitado y Barba",
        links: [
          { label: "Ceras de barbero", href: "/productos/barberia/ceras-barbero" },
          { label: "Champús de barba", href: "/productos/barberia/champus-barba" },
        ],
      },
      {
        titulo: "Styling y cuidado caballero",
        links: [
          { label: "Cuidado caballero", href: "/productos/barberia/cuidado-caballero" },
        ],
      },
    ],
  },
  {
    label: "Marcas",
    href: "/marcas",
  },
  {
    label: "Blog",
    href: "/blog",
  },
];

// ─── Mapa WooCommerce → taxonomía canónica ────────────────────────────────────
//
// Clave: WooCommerce category ID
// Valor: { categoria, subcategoria } según nuestra taxonomía
//
// Algoritmo de resolución en el script de importación:
//   1. Para cada producto, iterar sus categorías WooCommerce
//   2. Buscar la categoría más específica (leaf) en el mapa
//   3. Si no está, buscar la categoría padre en el mapa
//   4. Si sigue sin estar → fallback por raíz (Peluquería / Estética)

export const WOO_CAT_MAP: Record<number, { categoria: string; subcategoria: string }> = {

  // ── PELUQUERÍA · Coloración ───────────────────────────────────────────────
  99:  { categoria: "peluqueria", subcategoria: "tintes" },
  549: { categoria: "peluqueria", subcategoria: "sin-amoniaco" },
  102: { categoria: "peluqueria", subcategoria: "decoloracion" },
  104: { categoria: "peluqueria", subcategoria: "oxigenadas" },
  366: { categoria: "peluqueria", subcategoria: "tintes" },         // Cabellos Rubios
  413: { categoria: "peluqueria", subcategoria: "tintes" },         // Champú Mascarilla Color
  533: { categoria: "peluqueria", subcategoria: "tintes" },         // Mascarilla Color MASK PLATINUM
  959: { categoria: "peluqueria", subcategoria: "tintes" },         // Mascarilla Color FANOLA
  277: { categoria: "peluqueria", subcategoria: "tintes" },         // Mascarilla Color GLOSSCO
  561: { categoria: "peluqueria", subcategoria: "tintes" },         // Mascarilla Color YUNSEY
  411: { categoria: "peluqueria", subcategoria: "tintes" },         // Champu y Mascarilla Color VALQUER

  // ── PELUQUERÍA · Cuidado Capilar ─────────────────────────────────────────
  96:  { categoria: "peluqueria", subcategoria: "champus" },
  97:  { categoria: "peluqueria", subcategoria: "mascarillas" },
  92:  { categoria: "peluqueria", subcategoria: "acondicionadores" },
  61:  { categoria: "peluqueria", subcategoria: "ampollas-y-serums" },
  265: { categoria: "peluqueria", subcategoria: "ampollas-y-serums" }, // Ampollas Capilares
  95:  { categoria: "peluqueria", subcategoria: "ampollas-y-serums" }, // Serum y Brillos
  93:  { categoria: "peluqueria", subcategoria: "tratamientos" },
  100: { categoria: "peluqueria", subcategoria: "tratamientos" },    // Protectores Capilares
  203: { categoria: "peluqueria", subcategoria: "tratamientos" },    // Aceite Capilar

  // ── PELUQUERÍA · Styling ──────────────────────────────────────────────────
  101: { categoria: "peluqueria", subcategoria: "lacas" },
  94:  { categoria: "peluqueria", subcategoria: "espumas" },
  105: { categoria: "peluqueria", subcategoria: "gominas-y-ceras" },
  143: { categoria: "peluqueria", subcategoria: "gominas-y-ceras" }, // Gel fijación
  364: { categoria: "peluqueria", subcategoria: "rizos" },           // Definición Rizos
  573: { categoria: "peluqueria", subcategoria: "rizos" },           // Método Curly Girl
  194: { categoria: "peluqueria", subcategoria: "rizos" },           // Antiencrespado
  98:  { categoria: "peluqueria", subcategoria: "rizos" },           // Desrizantes
  106: { categoria: "peluqueria", subcategoria: "permanentes" },
  103: { categoria: "peluqueria", subcategoria: "permanentes" },     // Neutralizantes
  109: { categoria: "peluqueria", subcategoria: "permanentes" },     // Plis

  // ── PELUQUERÍA · Equipos y Herramientas ──────────────────────────────────
  121: { categoria: "peluqueria", subcategoria: "secadores-y-planchas" },
  120: { categoria: "peluqueria", subcategoria: "secadores-y-planchas" }, // Planchas
  107: { categoria: "peluqueria", subcategoria: "secadores-y-planchas" }, // Alisadores
  566: { categoria: "peluqueria", subcategoria: "secadores-y-planchas" }, // Cepillo Alisador
  124: { categoria: "peluqueria", subcategoria: "secadores-y-planchas" }, // Difusores
  123: { categoria: "peluqueria", subcategoria: "maquinas-corte" },
  239: { categoria: "peluqueria", subcategoria: "maquinas-corte" },  // Accesorios cortapelo
  156: { categoria: "peluqueria", subcategoria: "cepillos-y-peines" },
  79:  { categoria: "peluqueria", subcategoria: "tijeras" },          // Alicates y Tijeras
  157: { categoria: "peluqueria", subcategoria: "batas-y-capas" },
  158: { categoria: "peluqueria", subcategoria: "batas-y-capas" },   // Peinadores
  159: { categoria: "peluqueria", subcategoria: "utensilios" },       // Rulos
  160: { categoria: "peluqueria", subcategoria: "utensilios" },       // Clips y Horquillas
  161: { categoria: "peluqueria", subcategoria: "utensilios" },       // Redecillas
  207: { categoria: "peluqueria", subcategoria: "utensilios" },       // Grapas y Pinzas
  209: { categoria: "peluqueria", subcategoria: "utensilios" },       // Gorros
  216: { categoria: "peluqueria", subcategoria: "utensilios" },       // Pulverizadores
  224: { categoria: "peluqueria", subcategoria: "utensilios" },       // Desechables
  225: { categoria: "peluqueria", subcategoria: "utensilios" },       // Navaja utensilios peluq.
  125: { categoria: "peluqueria", subcategoria: "mobiliario" },       // Mobiliario
  126: { categoria: "peluqueria", subcategoria: "mobiliario" },       // Lavacabezas
  129: { categoria: "peluqueria", subcategoria: "mobiliario" },       // Portasecador
  244: { categoria: "peluqueria", subcategoria: "mobiliario" },       // Lavacabezas Recambios
  371: { categoria: "peluqueria", subcategoria: "peluqueria-general" }, // PACKS

  // ── ESTÉTICA · Facial ─────────────────────────────────────────────────────
  545: { categoria: "estetica", subcategoria: "cremas-faciales" },
  57:  { categoria: "estetica", subcategoria: "cremas-faciales" },   // Cremas genérico
  62:  { categoria: "estetica", subcategoria: "mascarillas-faciales" },
  140: { categoria: "estetica", subcategoria: "serums-faciales" },
  994: { categoria: "estetica", subcategoria: "serums-faciales" },   // Contorno de ojos
  574: { categoria: "estetica", subcategoria: "gel-facial" },
  575: { categoria: "estetica", subcategoria: "gel-facial" },        // Jabón de manos

  // ── ESTÉTICA · Corporal ───────────────────────────────────────────────────
  546: { categoria: "estetica", subcategoria: "cremas-corporales" },
  544: { categoria: "estetica", subcategoria: "cremas-corporales" }, // Cremas de manos
  58:  { categoria: "estetica", subcategoria: "aceites-corporales" },
  56:  { categoria: "estetica", subcategoria: "leche-corporal" },
  547: { categoria: "estetica", subcategoria: "peeling" },
  59:  { categoria: "estetica", subcategoria: "cremas-corporales" }, // Bronceador / Solar
  576: { categoria: "estetica", subcategoria: "cremas-corporales" }, // Bruma aromática
  426: { categoria: "estetica", subcategoria: "gel-corporal" },      // Gel de ducha

  // ── ESTÉTICA · Depilación ─────────────────────────────────────────────────
  68:  { categoria: "estetica", subcategoria: "depilatorios" },
  72:  { categoria: "estetica", subcategoria: "ceras-depiladoras" }, // Fundidores de cera

  // ── ESTÉTICA · Uñas y Maquillaje ─────────────────────────────────────────
  54:  { categoria: "estetica", subcategoria: "manicura-pedicura" },
  82:  { categoria: "estetica", subcategoria: "unas" },               // Limas
  81:  { categoria: "estetica", subcategoria: "unas" },               // Fresas
  83:  { categoria: "estetica", subcategoria: "unas" },               // Pinzas
  73:  { categoria: "estetica", subcategoria: "lamparas-uv" },
  85:  { categoria: "estetica", subcategoria: "maquillaje" },         // Esponjas
  65:  { categoria: "estetica", subcategoria: "maquillaje" },         // Pestañas y Ojos
  425: { categoria: "estetica", subcategoria: "maquillaje" },         // Labiales
  974: { categoria: "estetica", subcategoria: "maquillaje" },         // Máscaras pestañas

  // ── ESTÉTICA · Aparatos ───────────────────────────────────────────────────
  50:  { categoria: "estetica", subcategoria: "aparatos-estetica" },
  70:  { categoria: "estetica", subcategoria: "aparatos-estetica" },
  63:  { categoria: "estetica", subcategoria: "desechables-estetica" },

  // ── PELUQUERÍA · Champús por marca (subcategorías de id 96) ─────────────
  385:  { categoria: "peluqueria", subcategoria: "champus" },  // VALQUER
  991:  { categoria: "peluqueria", subcategoria: "champus" },  // TAHE
  282:  { categoria: "peluqueria", subcategoria: "champus" },  // YUNSEY
  298:  { categoria: "peluqueria", subcategoria: "champus" },  // FANOLA
  280:  { categoria: "peluqueria", subcategoria: "champus" },  // WELLA
  288:  { categoria: "peluqueria", subcategoria: "champus" },  // PERICHE
  293:  { categoria: "peluqueria", subcategoria: "champus" },  // KÉRASTASE
  529:  { categoria: "peluqueria", subcategoria: "champus" },  // HIPERTIN
  284:  { categoria: "peluqueria", subcategoria: "champus" },  // DR. SANTE
  286:  { categoria: "peluqueria", subcategoria: "champus" },  // KEEN STROK
  1004: { categoria: "peluqueria", subcategoria: "champus" },  // VIS PLANTIS
  281:  { categoria: "peluqueria", subcategoria: "champus" },  // GLOSSCO
  285:  { categoria: "peluqueria", subcategoria: "champus" },  // LIHETO
  289:  { categoria: "peluqueria", subcategoria: "champus" },  // L'ORÉAL
  997:  { categoria: "peluqueria", subcategoria: "champus" },  // SALERM
  538:  { categoria: "peluqueria", subcategoria: "champus" },  // KEYRA
  294:  { categoria: "peluqueria", subcategoria: "champus" },  // REVLON
  290:  { categoria: "peluqueria", subcategoria: "champus" },  // MONTIBELLO
  1024: { categoria: "peluqueria", subcategoria: "champus" },  // ARUAL
  283:  { categoria: "peluqueria", subcategoria: "champus" },  // SCHAWARZKOPF
  1017: { categoria: "peluqueria", subcategoria: "champus" },  // LENDAN
  291:  { categoria: "peluqueria", subcategoria: "champus" },  // NOVON
  292:  { categoria: "barberia",   subcategoria: "champus-barba" }, // KUUL for men

  // ── PELUQUERÍA · Acondicionadores por marca ───────────────────────────────
  386:  { categoria: "peluqueria", subcategoria: "acondicionadores" }, // VALQUER
  563:  { categoria: "peluqueria", subcategoria: "acondicionadores" }, // FANOLA
  556:  { categoria: "peluqueria", subcategoria: "acondicionadores" }, // YUNSEY
  555:  { categoria: "peluqueria", subcategoria: "acondicionadores" }, // Otras marcas
  554:  { categoria: "peluqueria", subcategoria: "acondicionadores" }, // WELLA
  557:  { categoria: "peluqueria", subcategoria: "acondicionadores" }, // SCHWARZKOPF
  559:  { categoria: "peluqueria", subcategoria: "acondicionadores" }, // REVLON
  1006: { categoria: "peluqueria", subcategoria: "acondicionadores" }, // VIS PLANTIS
  560:  { categoria: "peluqueria", subcategoria: "acondicionadores" }, // PERICHE
  553:  { categoria: "peluqueria", subcategoria: "acondicionadores" }, // L'OREAL
  996:  { categoria: "peluqueria", subcategoria: "acondicionadores" }, // TAHE
  998:  { categoria: "peluqueria", subcategoria: "acondicionadores" }, // SALERM
  552:  { categoria: "peluqueria", subcategoria: "acondicionadores" }, // KERASTASE
  558:  { categoria: "peluqueria", subcategoria: "acondicionadores" }, // GLOSSCO
  1023: { categoria: "peluqueria", subcategoria: "acondicionadores" }, // LENDAN
  1025: { categoria: "peluqueria", subcategoria: "acondicionadores" }, // ARUAL

  // ── PELUQUERÍA · Aparatos y otras ────────────────────────────────────────
  423:  { categoria: "peluqueria", subcategoria: "secadores-y-planchas" }, // Aparatos Peluqueria (id alt)
  119:  { categoria: "peluqueria", subcategoria: "secadores-y-planchas" }, // Aparatología Peluqueria
  443:  { categoria: "peluqueria", subcategoria: "ampollas-y-serums" },    // Aceites (oferta)
  442:  { categoria: "peluqueria", subcategoria: "ampollas-y-serums" },    // Ampollas (Oferta)

  // ── ESTÉTICA · Corporales ─────────────────────────────────────────────────
  66:   { categoria: "estetica", subcategoria: "cremas-corporales" }, // Corporales de Estética

  // ── BARBERÍA / Caballero · marcas completas ───────────────────────────────
  1027: { categoria: "barberia", subcategoria: "cuidado-caballero" }, // DON ALGODON
  1013: { categoria: "barberia", subcategoria: "cuidado-caballero" }, // COIFFER
  1012: { categoria: "barberia", subcategoria: "cuidado-caballero" }, // CANDELAHN
  1026: { categoria: "barberia", subcategoria: "cuidado-caballero" }, // CANTU
  945: { categoria: "barberia", subcategoria: "barberia-general" },   // BARBER SHOP raíz
  108: { categoria: "barberia", subcategoria: "ceras-barbero" },
  947: { categoria: "barberia", subcategoria: "cuidado-caballero" },  // HEY JOE
  948: { categoria: "barberia", subcategoria: "cuidado-caballero" },  // NOVON
  949: { categoria: "barberia", subcategoria: "cuidado-caballero" },  // KUUL for men
  946: { categoria: "barberia", subcategoria: "cuidado-caballero" },  // YUNSEY caballero
  295: { categoria: "barberia", subcategoria: "champus-barba" },

  // ── FALLBACKS raíz ────────────────────────────────────────────────────────
  91:  { categoria: "peluqueria", subcategoria: "peluqueria-general" },
  90:  { categoria: "peluqueria", subcategoria: "peluqueria-general" },
  49:  { categoria: "estetica",   subcategoria: "estetica-general"   },
  48:  { categoria: "estetica",   subcategoria: "estetica-general"   },
};

// ─── Plantillas SEO por subcategoría ─────────────────────────────────────────
//
// {nombre} = nombre del producto padre
// {marca}  = marca (puede ser vacío)
// Se truncan a 60 / 155 caracteres en el script

export const SEO_TEMPLATES: Record<string, { title: string; desc: string }> = {
  "tintes": {
    title: "{nombre} · Tinte Profesional",
    desc:  "Compra {nombre} al mejor precio. Tinte profesional de peluquería con cobertura perfecta y color duradero. ✓ Envío 24-48h a toda España.",
  },
  "sin-amoniaco": {
    title: "{nombre} · Tinte Sin Amoniaco",
    desc:  "Tinte sin amoniaco {nombre}. Coloración profesional respetuosa y brillante. ✓ Precio profesional. Envío 24-48h.",
  },
  "decoloracion": {
    title: "{nombre} · Decoloración Profesional",
    desc:  "Productos de decoloración profesional {nombre}. Mechas, balayage y aclarado perfecto. ✓ Envío 24-48h.",
  },
  "oxigenadas": {
    title: "{nombre} · Agua Oxigenada Profesional",
    desc:  "Agua oxigenada profesional {nombre}. Todos los volúmenes disponibles para peluquería. ✓ Envío 24-48h.",
  },
  "champus": {
    title: "{nombre} · Champú Profesional",
    desc:  "Champú profesional {nombre} para todo tipo de cabello. Calidad de peluquería a precio profesional. ✓ Envío 24-48h.",
  },
  "mascarillas": {
    title: "{nombre} · Mascarilla Capilar Profesional",
    desc:  "Mascarilla capilar {nombre} de uso profesional. Hidratación y nutrición intensiva para el cabello. ✓ Envío 24-48h.",
  },
  "acondicionadores": {
    title: "{nombre} · Acondicionador Profesional",
    desc:  "Acondicionador profesional {nombre}. Suaviza y desenreda sin apelmazar. Calidad de peluquería. ✓ Envío 24-48h.",
  },
  "ampollas-y-serums": {
    title: "{nombre} · Ampolla y Sérum Capilar",
    desc:  "Ampollas y sérums capilares {nombre}. Tratamiento intensivo de uso profesional. ✓ Envío 24-48h.",
  },
  "tratamientos": {
    title: "{nombre} · Tratamiento Capilar Profesional",
    desc:  "Tratamiento capilar profesional {nombre}. Repara, fortalece y protege el cabello dañado. ✓ Envío 24-48h.",
  },
  "lacas": {
    title: "{nombre} · Laca Fijadora Profesional",
    desc:  "Laca de fijación profesional {nombre}. Fijación duradera sin residuos, uso en peluquería. ✓ Envío 24-48h.",
  },
  "espumas": {
    title: "{nombre} · Espuma de Fijación Profesional",
    desc:  "Espuma de fijación {nombre} para peluquería. Volumen y definición de larga duración. ✓ Envío 24-48h.",
  },
  "gominas-y-ceras": {
    title: "{nombre} · Gomina y Cera de Estilismo",
    desc:  "Gomina y cera de estilismo {nombre}. Fijación profesional para todo tipo de acabado. ✓ Envío 24-48h.",
  },
  "rizos": {
    title: "{nombre} · Producto para Rizos Profesional",
    desc:  "Definición de rizos con {nombre}. Anticrespo y curl cream de peluquería profesional. ✓ Envío 24-48h.",
  },
  "permanentes": {
    title: "{nombre} · Permanente y Alisado Profesional",
    desc:  "Permanente y alisado profesional {nombre}. Resultados duraderos y de calidad. ✓ Envío 24-48h.",
  },
  "cremas-faciales": {
    title: "{nombre} · Crema Facial Profesional",
    desc:  "Crema facial {nombre} de uso profesional para estética. Hidratación y cuidado intensivo de la piel. ✓ Envío 24-48h.",
  },
  "mascarillas-faciales": {
    title: "{nombre} · Mascarilla Facial Profesional",
    desc:  "Mascarilla facial {nombre} para estética profesional. Tratamiento intensivo y purificante. ✓ Envío 24-48h.",
  },
  "serums-faciales": {
    title: "{nombre} · Sérum Facial Profesional",
    desc:  "Sérum y contorno de ojos {nombre} de uso profesional. Concentrado activo para una piel perfecta. ✓ Envío 24-48h.",
  },
  "cremas-corporales": {
    title: "{nombre} · Crema Corporal Profesional",
    desc:  "Crema corporal {nombre} para uso profesional en estética. Hidratación profunda y duradera. ✓ Envío 24-48h.",
  },
  "depilatorios": {
    title: "{nombre} · Depilatorio Profesional",
    desc:  "Depilatorio profesional {nombre} para estética. Piel suave y sin vello con resultados duraderos. ✓ Envío 24-48h.",
  },
  "ceras-depiladoras": {
    title: "{nombre} · Cera Depilatoria Profesional",
    desc:  "Cera depilatoria profesional {nombre}. Compatible con todos los tipos de cera y piel. ✓ Envío 24-48h.",
  },
  "manicura-pedicura": {
    title: "{nombre} · Manicura y Pedicura Profesional",
    desc:  "Productos de manicura y pedicura {nombre} para uso profesional. Uñas perfectas a precio de salón. ✓ Envío 24-48h.",
  },
  "ceras-barbero": {
    title: "{nombre} · Cera Barbero Profesional",
    desc:  "Cera de barbero {nombre} para afeitado y estilismo. Resultado profesional y duradero. ✓ Envío 24-48h.",
  },
  "default": {
    title: "{nombre} · Producto Profesional",
    desc:  "Compra {nombre} al mejor precio en Esencia de Belleza. Productos profesionales de peluquería y estética. ✓ Envío 24-48h.",
  },
};
