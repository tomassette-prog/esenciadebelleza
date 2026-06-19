/**
 * lib/seo-generator.ts
 *
 * Genera automáticamente seo_title, seo_description y texto_enriquecido_seo
 * para cada producto en el momento de importación.
 *
 * Sin dependencias externas (sin IA) — basado en plantillas por categoría.
 * Las plantillas están diseñadas para maximizar la relevancia de búsqueda
 * en Google España para productos de peluquería, estética y barbería.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface InputProductoSeo {
  nombre: string;
  marca: string | null;
  categoria: string;
  subcategoria: string | null;
  descripcion: string | null; // HTML o texto plano
}

export interface OutputSeo {
  seo_title: string;       // máx 60 chars
  seo_description: string; // máx 155 chars
  texto_enriquecido_seo: string; // HTML con <h2>/<p>
}

// ─── Categorías SEO ───────────────────────────────────────────────────────────

/**
 * Identifica el "tipo semántico" de un producto según categoría/subcategoría.
 * Esto permite aplicar plantillas de texto específicas con las palabras clave
 * adecuadas para cada tipo de producto.
 */
type TipoProducto =
  | "tinte"
  | "decoloracion"
  | "oxigenada"
  | "champu"
  | "mascarilla_capilar"
  | "acondicionador"
  | "ampolla_serum_capilar"
  | "tratamiento_capilar"
  | "laca"
  | "espuma"
  | "gomina_cera"
  | "rizos"
  | "permanente"
  | "secador_plancha"
  | "maquina_corte"
  | "cepillo_peine"
  | "tijera"
  | "bata_capa"
  | "crema_facial"
  | "mascarilla_facial"
  | "serum_facial"
  | "limpieza_facial"
  | "crema_corporal"
  | "depilacion"
  | "bronceador"
  | "manicura"
  | "maquillaje"
  | "perfume"
  | "cera_barbero"
  | "afeitado"
  | "coloracion_barba"
  | "keratina"
  | "alisado"
  | "otro";

function detectarTipo(categoria: string, subcategoria: string | null): TipoProducto {
  const cat = categoria.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const sub = (subcategoria ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const texto = `${cat} ${sub}`;

  if (/decolor/.test(texto))               return "decoloracion";
  if (/oxigen/.test(texto))                return "oxigenada";
  if (/tinte|color/.test(texto))           return "tinte";
  if (/champu|shampoo|xamp/.test(texto))   return "champu";
  if (/mascarilla.*(capilar|pelo|cabello|hair)/.test(texto)) return "mascarilla_capilar";
  if (/mascarilla.*(facial|cara|piel)/.test(texto))          return "mascarilla_facial";
  if (/mascarilla/.test(texto) && /estetic/.test(cat))       return "mascarilla_facial";
  if (/mascarilla/.test(texto))            return "mascarilla_capilar";
  if (/acondicion/.test(texto))            return "acondicionador";
  if (/ampolla|serum|ser.m|ampol/.test(texto) && !/facial/.test(texto)) return "ampolla_serum_capilar";
  if (/serum|ser.m|contorno/.test(texto) && /estetic/.test(cat)) return "serum_facial";
  if (/tratamiento/.test(texto) && !/facial/.test(texto))    return "tratamiento_capilar";
  if (/laca/.test(texto))                  return "laca";
  if (/espuma/.test(texto))                return "espuma";
  if (/gomina|cera|gel.*(pelo|capilar)|wax/.test(texto) && !/barber/.test(cat)) return "gomina_cera";
  if (/rizo|anticrespo|curl/.test(texto))  return "rizos";
  if (/permanente/.test(texto))            return "permanente";
  if (/keratina/.test(texto))              return "keratina";
  if (/alisad/.test(texto))                return "alisado";
  if (/secador|plancha|rizador/.test(texto)) return "secador_plancha";
  if (/maquin.*(corte|peluq)|clipper/.test(texto)) return "maquina_corte";
  if (/cepillo|peine|brush/.test(texto))   return "cepillo_peine";
  if (/tijera|navaja/.test(texto))         return "tijera";
  if (/bata|capa|mantel/.test(texto))      return "bata_capa";
  if (/crema.*(facial|cara)|facial.*(crema)/.test(texto)) return "crema_facial";
  if (/gel.*(facial|limpieza)|limpieza.*facial/.test(texto)) return "limpieza_facial";
  if (/crema.*(corporal|cuerpo|body)/.test(texto)) return "crema_corporal";
  if (/depilac/.test(texto))               return "depilacion";
  if (/broncea|autobronc/.test(texto))     return "bronceador";
  if (/man[iy]cur|esmalte|u[ñn]as/.test(texto)) return "manicura";
  if (/maquillaje|makeup|base|labial|sombra|rimel/.test(texto)) return "maquillaje";
  if (/perfume|colonia|eau de/.test(texto)) return "perfume";
  if (/cera|pomada|pasta/.test(texto) && /barber/.test(cat)) return "cera_barbero";
  if (/afeitar|afeitad|shaving/.test(texto)) return "afeitado";
  if (/barba/.test(texto))                 return "coloracion_barba";

  return "otro";
}

// ─── Extracción de texto plano desde HTML ─────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrae los primeros N caracteres de la descripción limpia (sin HTML).
 * Útil para incluir fragmentos de la descripción original en la meta description.
 */
function extractoDescripcion(desc: string | null, maxChars = 100): string {
  if (!desc) return "";
  const limpia = stripHtml(desc).slice(0, maxChars * 2);
  const punto = limpia.indexOf(".", 30);
  if (punto > 0 && punto < maxChars) return limpia.slice(0, punto + 1);
  return limpia.slice(0, maxChars);
}

// ─── Plantillas por tipo ──────────────────────────────────────────────────────

interface Plantilla {
  titleSuffix: string;         // lo que va tras "[Marca] [Nombre]"
  descTemplate: (ctx: TemplateCtx) => string;
  h2: string;
  parrafo1: (ctx: TemplateCtx) => string;
  parrafo2: (ctx: TemplateCtx) => string;
  keywords: string[];          // palabras clave de apoyo para el texto enriquecido
}

interface TemplateCtx {
  nombre: string;
  marca: string;
  categoria: string;
  subcategoria: string;
  fragmentoDesc: string;
}

const PLANTILLAS: Record<TipoProducto, Plantilla> = {
  tinte: {
    titleSuffix: "— Tinte Capilar",
    descTemplate: ({ nombre, marca, fragmentoDesc }) =>
      fragmentoDesc
        ? `${marca ? `${marca} ` : ""}${nombre}: ${fragmentoDesc} Compra online con envío rápido en España.`
        : `Tinte capilar ${marca ? `${marca} ` : ""}${nombre}. Cobertura perfecta y colores vibrantes. Envío rápido en España.`,
    h2: "Coloración profesional de alta cobertura",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es un tinte capilar profesional formulado para ofrecer una coloración intensa y duradera. Su tecnología avanzada garantiza una cobertura total de canas y un acabado brillante sin dañar la fibra capilar.`,
    parrafo2: ({ nombre }) =>
      `Ideal para uso en peluquería profesional y en casa, ${nombre} proporciona resultados uniformes desde las raíces hasta las puntas. Combínalo con la oxigenada adecuada para potenciar el resultado. Disponible en Esencia de Belleza con envío rápido a toda España.`,
    keywords: ["tinte capilar profesional", "coloración capilar", "tinte cobertura canas", "tinte peluquería"],
  },

  decoloracion: {
    titleSuffix: "— Decoloración Capilar",
    descTemplate: ({ nombre, marca }) =>
      `Decoloración capilar ${marca ? `${marca} ` : ""}${nombre}. Aclaramiento controlado y protección del cabello. Envío rápido en España.`,
    h2: "Decoloración profesional para un aclaramiento preciso",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es un producto de decoloración capilar profesional que permite aclarar el cabello de forma controlada y uniforme, minimizando el daño sobre la fibra. Su fórmula avanzada con activos protectores mantiene la hidratación durante el proceso.`,
    parrafo2: () =>
      `Imprescindible en cualquier peluquería profesional para realizar mechas, balayage y trabajos de aclarado. Úsalo siempre con la oxigenada de volumen adecuada para obtener el resultado deseado. Disponible en Esencia de Belleza con envío rápido a toda España.`,
    keywords: ["decoloración capilar profesional", "aclarador pelo", "decoloración mechas", "balayage"],
  },

  oxigenada: {
    titleSuffix: "— Agua Oxigenada",
    descTemplate: ({ nombre, marca }) =>
      `Agua oxigenada ${marca ? `${marca} ` : ""}${nombre}. Revelador para tinte y decoloración. Envío rápido en España.`,
    h2: "Revelador de oxidación para coloración profesional",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es un agua oxigenada (revelador de oxidación) diseñada para activar la coloración capilar y la decoloración de forma controlada. Su formulación estabilizada garantiza una reacción uniforme que respeta la estructura del cabello.`,
    parrafo2: () =>
      `Compatible con la mayoría de tintes y decolorantes profesionales. Elige el volumen adecuado (10, 20, 30 o 40 vol.) según el nivel de aclarado o cobertura que necesites. Disponible en Esencia de Belleza con envío rápido.`,
    keywords: ["agua oxigenada peluquería", "revelador oxidación", "oxigenada 30 vol", "oxigenada 20 vol"],
  },

  champu: {
    titleSuffix: "— Champú Capilar",
    descTemplate: ({ nombre, marca, fragmentoDesc }) =>
      fragmentoDesc
        ? `${marca ? `${marca} ` : ""}${nombre}: ${fragmentoDesc} Compra online con envío rápido.`
        : `Champú profesional ${marca ? `${marca} ` : ""}${nombre}. Limpieza profunda y cuidado capilar. Envío rápido en España.`,
    h2: "Limpieza y cuidado capilar con fórmula profesional",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es un champú profesional formulado con ingredientes de alta calidad para proporcionar una limpieza profunda y suave al mismo tiempo. Su fórmula equilibra el pH del cuero cabelludo y aporta hidratación desde el primer lavado.`,
    parrafo2: () =>
      `Apto para uso frecuente en peluquería y en casa. Combínalo con la mascarilla o acondicionador de la misma gama para obtener resultados óptimos. Disponible en Esencia de Belleza con envío rápido a toda España.`,
    keywords: ["champú profesional", "champú capilar", "champú peluquería", "cuidado del cabello"],
  },

  mascarilla_capilar: {
    titleSuffix: "— Mascarilla Capilar",
    descTemplate: ({ nombre, marca, fragmentoDesc }) =>
      fragmentoDesc
        ? `${marca ? `${marca} ` : ""}${nombre}: ${fragmentoDesc} Envío rápido en España.`
        : `Mascarilla capilar ${marca ? `${marca} ` : ""}${nombre}. Hidratación y reparación intensiva. Envío rápido en España.`,
    h2: "Tratamiento intensivo de hidratación y reparación capilar",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es una mascarilla capilar de tratamiento intensivo que nutre, hidrata y repara el cabello desde el interior. Su fórmula enriquecida con activos reparadores restaura la fibra capilar dañada por el calor, la coloración y los agentes externos.`,
    parrafo2: () =>
      `Aplica sobre el cabello limpio y húmedo, deja actuar de 5 a 15 minutos y aclara. Para mayor intensidad, usa bajo un gorro térmico. Disponible en Esencia de Belleza con envío rápido a toda España.`,
    keywords: ["mascarilla capilar profesional", "tratamiento hidratante pelo", "reparación capilar", "mascarilla nutritiva"],
  },

  acondicionador: {
    titleSuffix: "— Acondicionador Capilar",
    descTemplate: ({ nombre, marca }) =>
      `Acondicionador profesional ${marca ? `${marca} ` : ""}${nombre}. Suavidad y brillo para todo tipo de cabello. Envío rápido en España.`,
    h2: "Acondicionador profesional para cabello suave y brillante",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es un acondicionador capilar de uso profesional que desenreda, suaviza y aporta brillo al cabello con cada aplicación. Su fórmula de hidratación inmediata sella la cutícula del cabello para un acabado liso y sedoso.`,
    parrafo2: () =>
      `Ideal para todo tipo de cabello, especialmente el seco o con daño por coloración. Aplica tras el champú, deja actuar 2 minutos y aclara con agua. Disponible en Esencia de Belleza con envío rápido.`,
    keywords: ["acondicionador profesional", "suavizante capilar", "acondicionador peluquería", "brillo cabello"],
  },

  ampolla_serum_capilar: {
    titleSuffix: "— Ampollas Capilares",
    descTemplate: ({ nombre, marca }) =>
      `Ampollas capilares ${marca ? `${marca} ` : ""}${nombre}. Tratamiento concentrado de reparación y brillo. Envío rápido.`,
    h2: "Tratamiento capilar concentrado en ampollas",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es un tratamiento capilar en ampollas o sérum de alta concentración diseñado para reparar y revitalizar el cabello de forma intensiva. Sus activos penetran en profundidad en la fibra capilar para restaurar la hidratación y el brillo natural.`,
    parrafo2: () =>
      `Aplica una ampolla sobre el cabello limpio y húmedo antes del secado, o directamente sobre puntas secas. Ideal para curas intensivas semanales o ante señales evidentes de daño. Disponible en Esencia de Belleza.`,
    keywords: ["ampollas capilares", "sérum capilar", "tratamiento concentrado pelo", "ampollas reparadoras"],
  },

  tratamiento_capilar: {
    titleSuffix: "— Tratamiento Capilar",
    descTemplate: ({ nombre, marca, fragmentoDesc }) =>
      fragmentoDesc
        ? `${marca ? `${marca} ` : ""}${nombre}: ${fragmentoDesc} Envío rápido en España.`
        : `Tratamiento capilar profesional ${marca ? `${marca} ` : ""}${nombre}. Cuida y fortalece tu cabello. Envío rápido.`,
    h2: "Tratamiento profesional para el cuidado del cabello",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es un tratamiento capilar profesional formulado para cubrir las necesidades específicas de tu cabello. Su tecnología de última generación actúa en profundidad para fortalecer, hidratar o reparar según el tipo de cuidado que requiera.`,
    parrafo2: () =>
      `Recomendado por estilistas profesionales para mantener el cabello en óptimas condiciones. Compatible con cabellos tratados, teñidos o naturales. Disponible en Esencia de Belleza con envío rápido a toda España.`,
    keywords: ["tratamiento capilar profesional", "cuidado del cabello", "tratamiento capilar peluquería"],
  },

  laca: {
    titleSuffix: "— Laca Fijadora",
    descTemplate: ({ nombre, marca }) =>
      `Laca fijadora ${marca ? `${marca} ` : ""}${nombre}. Fijación duradera y acabado perfecto. Envío rápido en España.`,
    h2: "Fijación y control del peinado con laca profesional",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es una laca capilar profesional que proporciona fijación duradera al peinado sin apelmazar el cabello. Su spray de microdifusión garantiza una distribución uniforme del producto para un acabado natural o extra fuerte, según la fórmula.`,
    parrafo2: () =>
      `Ideal para uso en peluquería y en casa. Resiste la humedad y mantiene el peinado a lo largo del día. Disponible en Esencia de Belleza con envío rápido a toda España.`,
    keywords: ["laca capilar profesional", "spray fijador pelo", "laca peluquería", "fijador capilar"],
  },

  espuma: {
    titleSuffix: "— Espuma Capilar",
    descTemplate: ({ nombre, marca }) =>
      `Espuma capilar ${marca ? `${marca} ` : ""}${nombre}. Volumen y definición para todo tipo de cabello. Envío rápido.`,
    h2: "Volumen y definición con espuma capilar profesional",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es una espuma capilar de formulación profesional que aporta volumen, cuerpo y definición al cabello. Su textura ligera se distribuye uniformemente sin dejar residuos ni apelmazar el cabello.`,
    parrafo2: () =>
      `Aplica sobre el cabello húmedo y trabaja con los dedos o cepillo antes del secado. Perfecta para crear estilos con movimiento, rizos definidos o mayor volumen en cabellos finos. Disponible en Esencia de Belleza.`,
    keywords: ["espuma capilar profesional", "mousse pelo", "espuma volumen", "styling capilar"],
  },

  gomina_cera: {
    titleSuffix: "— Gomina y Cera Capilar",
    descTemplate: ({ nombre, marca }) =>
      `Gomina capilar ${marca ? `${marca} ` : ""}${nombre}. Fijación y modelado con acabado profesional. Envío rápido España.`,
    h2: "Modelado y fijación capilar con textura profesional",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es un producto de styling capilar con textura de gel, cera o pomada que permite modelar y fijar el peinado con precisión. Ofrece un acabado natural, brillante o mate según la fórmula, con fijación duradera a lo largo del día.`,
    parrafo2: () =>
      `Aplica una pequeña cantidad sobre el cabello seco o húmedo y modela a tu gusto. Apto para todo tipo de peinados y texturas. Disponible en Esencia de Belleza con envío rápido a toda España.`,
    keywords: ["gomina capilar", "cera pelo profesional", "styling capilar", "gel fijador"],
  },

  rizos: {
    titleSuffix: "— Rizos y Anticrespo",
    descTemplate: ({ nombre, marca }) =>
      `${marca ? `${marca} ` : ""}${nombre}: definición de rizos y control del frizz. Envío rápido en España.`,
    h2: "Definición de rizos y control del encrespamiento",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} está formulado específicamente para cabellos rizados y ondulados. Define y potencia los rizos naturales, controla el frizz y aporta hidratación para un cabello rizado saludable y con forma.`,
    parrafo2: () =>
      `Aplica sobre el cabello húmedo, esculpe los rizos con los dedos y deja secar al aire o con difusor. Combínalo con una mascarilla o acondicionador sin aclarado para maximizar la hidratación. Disponible en Esencia de Belleza.`,
    keywords: ["definidor rizos profesional", "anticrespo capilar", "producto rizos", "control frizz"],
  },

  permanente: {
    titleSuffix: "— Permanente Capilar",
    descTemplate: ({ nombre, marca }) =>
      `Permanente capilar ${marca ? `${marca} ` : ""}${nombre}. Ondas duraderas con cuidado de la fibra. Envío rápido España.`,
    h2: "Rizado permanente profesional de larga duración",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es una solución de permanente capilar profesional que crea ondas o rizos duraderos respetando al máximo la integridad de la fibra capilar. Su fórmula avanzada incluye agentes protectores que minimizan el daño durante el proceso.`,
    parrafo2: () =>
      `Apto para uso profesional en peluquería. Sigue las instrucciones de aplicación al detalle para obtener el resultado deseado. Disponible en Esencia de Belleza con envío rápido a toda España.`,
    keywords: ["permanente capilar", "rizos permanentes", "solución permanente peluquería"],
  },

  keratina: {
    titleSuffix: "— Keratina Capilar",
    descTemplate: ({ nombre, marca }) =>
      `Keratina capilar ${marca ? `${marca} ` : ""}${nombre}. Alisado y nutrición profunda de la fibra. Envío rápido España.`,
    h2: "Tratamiento de keratina para cabello liso y nutrido",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es un tratamiento de keratina profesional que alisa, nutre y repara la fibra capilar desde el interior. Su fórmula de keratina hidrolizada rellena los huecos de la cutícula, eliminando el frizz y aportando brillo y suavidad duraderos.`,
    parrafo2: () =>
      `Ideal para cabellos con daño por decoloración, calor o agentes externos. El resultado puede durar hasta 3-4 meses con el mantenimiento adecuado. Disponible en Esencia de Belleza con envío rápido.`,
    keywords: ["keratina capilar profesional", "tratamiento keratina", "alisado keratina", "keratina pelo"],
  },

  alisado: {
    titleSuffix: "— Alisado Capilar",
    descTemplate: ({ nombre, marca }) =>
      `Alisado capilar ${marca ? `${marca} ` : ""}${nombre}. Liso perfecto y duradero con cuidado de la fibra. Envío rápido.`,
    h2: "Tratamiento de alisado capilar de larga duración",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es un tratamiento alisador profesional que transforma el cabello rizado o encrespado en un cabello liso, sedoso y manejable. Su acción duradera garantiza resultados visibles durante semanas.`,
    parrafo2: () =>
      `Combínalo con un champú y acondicionador específicos para alisado para prolongar el efecto. Disponible en Esencia de Belleza con envío rápido a toda España.`,
    keywords: ["alisado capilar profesional", "tratamiento alisador", "liso permanente", "alisado pelo"],
  },

  secador_plancha: {
    titleSuffix: "— Herramienta de Peluquería",
    descTemplate: ({ nombre, marca }) =>
      `${marca ? `${marca} ` : ""}${nombre}: herramienta profesional de peluquería. Potencia y durabilidad. Envío rápido España.`,
    h2: "Herramientas profesionales de peluquería",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es una herramienta profesional de peluquería diseñada para uso intensivo en salón. Combina potencia, tecnología de protección térmica y ergonomía para facilitar el trabajo del estilista y proteger el cabello del cliente.`,
    parrafo2: () =>
      `Fabricada con materiales de primera calidad para garantizar una larga vida útil. Ideal tanto para uso profesional en peluquería como en casa. Disponible en Esencia de Belleza con envío rápido a toda España.`,
    keywords: ["secador profesional peluquería", "plancha alisadora profesional", "herramienta peluquería"],
  },

  maquina_corte: {
    titleSuffix: "— Máquina de Corte",
    descTemplate: ({ nombre, marca }) =>
      `Máquina de corte ${marca ? `${marca} ` : ""}${nombre}. Precisión y potencia para el corte profesional. Envío rápido.`,
    h2: "Máquinas de corte y acabado profesional",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es una máquina de corte profesional de alto rendimiento, pensada para el trabajo diario en peluquería y barbería. Sus cuchillas de precisión garantizan un corte limpio y uniforme en todo tipo de texturas de cabello.`,
    parrafo2: () =>
      `Con tecnología de bajo ruido, batería de larga duración y ergonomía cuidada. Disponible en Esencia de Belleza con envío rápido a toda España.`,
    keywords: ["máquina corte pelo profesional", "clipper peluquería", "maquinilla cabello"],
  },

  cepillo_peine: {
    titleSuffix: "— Cepillos y Peines",
    descTemplate: ({ nombre, marca }) =>
      `${marca ? `${marca} ` : ""}${nombre}: cepillo/peine profesional de peluquería. Calidad y durabilidad. Envío rápido España.`,
    h2: "Cepillos y peines profesionales de peluquería",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es un accesorio de peluquería profesional diseñado para facilitar el peinado, el cepillado y el styling del cabello. Sus materiales de calidad garantizan una larga vida útil y un acabado perfecto.`,
    parrafo2: () =>
      `Disponible en Esencia de Belleza con envío rápido a toda España. Complementa tu kit de herramientas de peluquería con los mejores accesorios profesionales.`,
    keywords: ["cepillo peluquería profesional", "peine profesional", "accesorio peluquería"],
  },

  tijera: {
    titleSuffix: "— Tijeras de Peluquería",
    descTemplate: ({ nombre, marca }) =>
      `Tijera de peluquería ${marca ? `${marca} ` : ""}${nombre}. Corte de precisión para profesionales. Envío rápido España.`,
    h2: "Tijeras de peluquería de precisión profesional",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} son tijeras de peluquería profesional fabricadas con acero de alta calidad para un corte limpio y preciso. Su diseño ergonómico reduce la fatiga en jornadas de trabajo intensas.`,
    parrafo2: () =>
      `Ideales para cortes de cabello, acabados y texturizados. Disponibles en Esencia de Belleza con envío rápido a toda España.`,
    keywords: ["tijeras peluquería profesional", "tijera corte pelo", "tijera estilista"],
  },

  bata_capa: {
    titleSuffix: "— Batas y Capas de Peluquería",
    descTemplate: ({ nombre, marca }) =>
      `${marca ? `${marca} ` : ""}${nombre}: bata/capa profesional de peluquería. Comodidad y protección. Envío rápido España.`,
    h2: "Batas y capas profesionales para peluquería",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es una bata o capa profesional diseñada para proteger al cliente durante los servicios de peluquería. Fabricada con materiales resistentes y de fácil limpieza para uso intensivo en salón.`,
    parrafo2: () =>
      `Disponible en Esencia de Belleza con envío rápido a toda España. Mantén tu salón equipado con los mejores materiales profesionales.`,
    keywords: ["capa peluquería profesional", "bata peluquería", "protector cliente peluquería"],
  },

  crema_facial: {
    titleSuffix: "— Crema Facial",
    descTemplate: ({ nombre, marca, fragmentoDesc }) =>
      fragmentoDesc
        ? `${marca ? `${marca} ` : ""}${nombre}: ${fragmentoDesc} Envío rápido en España.`
        : `Crema facial ${marca ? `${marca} ` : ""}${nombre}. Hidratación y cuidado de la piel. Envío rápido en España.`,
    h2: "Crema facial para una piel hidratada y cuidada",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es una crema facial de formulación avanzada que hidrata, nutre y protege la piel del rostro. Sus ingredientes activos actúan en profundidad para mejorar la textura, luminosidad y elasticidad de la piel con uso regular.`,
    parrafo2: () =>
      `Apta para uso diario, mañana y/o noche según la fórmula. Disponible en Esencia de Belleza con envío rápido a toda España. Descubre nuestra completa gama de cuidado facial.`,
    keywords: ["crema facial hidratante", "cuidado facial profesional", "crema para la cara", "hidratante facial"],
  },

  mascarilla_facial: {
    titleSuffix: "— Mascarilla Facial",
    descTemplate: ({ nombre, marca }) =>
      `Mascarilla facial ${marca ? `${marca} ` : ""}${nombre}. Tratamiento intensivo para una piel perfecta. Envío rápido España.`,
    h2: "Tratamiento facial intensivo con mascarilla profesional",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es una mascarilla facial de uso profesional que proporciona un tratamiento intensivo en pocas aplicaciones. Su fórmula concentrada penetra en profundidad para limpiar, hidratar, iluminar o tratar según el tipo de mascarilla.`,
    parrafo2: () =>
      `Úsala 1-2 veces por semana sobre la piel limpia. Deja actuar el tiempo indicado y retira con agua tibia o con un paño húmedo. Disponible en Esencia de Belleza con envío rápido.`,
    keywords: ["mascarilla facial profesional", "tratamiento facial intensivo", "mascarilla cara", "cuidado facial"],
  },

  serum_facial: {
    titleSuffix: "— Sérum Facial",
    descTemplate: ({ nombre, marca }) =>
      `Sérum facial ${marca ? `${marca} ` : ""}${nombre}. Tratamiento concentrado antiedad e iluminador. Envío rápido España.`,
    h2: "Sérum facial de alta concentración para resultados visibles",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es un sérum facial de textura ligera y alta concentración de activos que penetra rápidamente en la piel para tratar arrugas, manchas, falta de luminosidad o deshidratación. Su fórmula potenciadora maximiza la eficacia de la crema que apliques después.`,
    parrafo2: () =>
      `Aplica unas gotas sobre la piel limpia antes de la crema hidratante. Ideal para amplificar cualquier rutina de cuidado facial. Disponible en Esencia de Belleza con envío rápido a toda España.`,
    keywords: ["sérum facial profesional", "suero antiedad", "sérum vitamina C", "tratamiento facial concentrado"],
  },

  limpieza_facial: {
    titleSuffix: "— Limpieza Facial",
    descTemplate: ({ nombre, marca }) =>
      `${marca ? `${marca} ` : ""}${nombre}: limpieza facial profunda y suave. Para una piel perfecta. Envío rápido España.`,
    h2: "Limpieza facial profunda para una piel equilibrada",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es un producto de limpieza facial que elimina eficazmente el maquillaje, la suciedad y el exceso de grasa sin agredir la piel. Su fórmula respetuosa mantiene el equilibrio natural del manto hidrolipídico.`,
    parrafo2: () =>
      `Úsalo como primer paso de tu rutina de cuidado facial, mañana y noche. Disponible en Esencia de Belleza con envío rápido a toda España.`,
    keywords: ["limpiador facial profesional", "gel limpiador cara", "desmaquillante", "limpieza facial profunda"],
  },

  crema_corporal: {
    titleSuffix: "— Crema Corporal",
    descTemplate: ({ nombre, marca }) =>
      `Crema corporal ${marca ? `${marca} ` : ""}${nombre}. Hidratación profunda y piel suave. Envío rápido en España.`,
    h2: "Hidratación corporal profunda y duradera",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es una crema corporal de uso diario que hidrata y nutre la piel del cuerpo de forma intensa y duradera. Su textura cremosa se absorbe rápidamente sin dejar residuos grasos, dejando la piel suave y sedosa.`,
    parrafo2: () =>
      `Aplica sobre la piel limpia y seca después del baño o ducha. Ideal para pieles secas o normales. Disponible en Esencia de Belleza con envío rápido a toda España.`,
    keywords: ["crema corporal hidratante", "loción corporal", "hidratante cuerpo", "cuidado piel corporal"],
  },

  depilacion: {
    titleSuffix: "— Depilación Profesional",
    descTemplate: ({ nombre, marca }) =>
      `${marca ? `${marca} ` : ""}${nombre}: depilación profesional eficaz y suave. Resultados duraderos. Envío rápido España.`,
    h2: "Depilación profesional para resultados suaves y duraderos",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es un producto de depilación profesional formulado para ofrecer una eliminación eficaz del vello con el mínimo daño sobre la piel. Su fórmula incluye agentes calmantes e hidratantes que reducen el enrojecimiento y la irritación post-depilación.`,
    parrafo2: () =>
      `Ideal para uso en centro de estética y en casa. Disponible en Esencia de Belleza con envío rápido a toda España.`,
    keywords: ["cera depilatoria profesional", "depilación estética", "depiladora profesional"],
  },

  bronceador: {
    titleSuffix: "— Bronceador",
    descTemplate: ({ nombre, marca }) =>
      `Bronceador ${marca ? `${marca} ` : ""}${nombre}. Bronceado natural y duradero con cuidado de la piel. Envío rápido.`,
    h2: "Bronceado natural y seguro con fórmula profesional",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es un bronceador o autobronceador de uso profesional que proporciona un bronceado uniforme, natural y duradero. Su fórmula con activos hidratantes cuida la piel durante el proceso, evitando manchas y tonos anaranjados.`,
    parrafo2: () =>
      `Disponible en Esencia de Belleza con envío rápido a toda España. Consigue el bronceado perfecto en cualquier época del año.`,
    keywords: ["bronceador profesional", "autobronceador", "crema bronceadora", "bronceado artificial"],
  },

  manicura: {
    titleSuffix: "— Manicura y Uñas",
    descTemplate: ({ nombre, marca }) =>
      `${marca ? `${marca} ` : ""}${nombre}: productos profesionales de manicura. Uñas perfectas. Envío rápido en España.`,
    h2: "Productos profesionales de manicura y uñas",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es un producto de manicura profesional diseñado para el cuidado y embellecimiento de las uñas. Su formulación garantiza resultados duraderos con un acabado impecable, tanto para uso en salón como en casa.`,
    parrafo2: () =>
      `Disponible en Esencia de Belleza con envío rápido a toda España. Descubre nuestra completa gama de productos para manicura y nail art profesional.`,
    keywords: ["manicura profesional", "esmalte uñas profesional", "productos nail art", "cuidado uñas"],
  },

  maquillaje: {
    titleSuffix: "— Maquillaje Profesional",
    descTemplate: ({ nombre, marca, fragmentoDesc }) =>
      fragmentoDesc
        ? `${marca ? `${marca} ` : ""}${nombre}: ${fragmentoDesc} Envío rápido en España.`
        : `Maquillaje profesional ${marca ? `${marca} ` : ""}${nombre}. Acabado perfecto y larga duración. Envío rápido España.`,
    h2: "Maquillaje profesional para un acabado impecable",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es un producto de maquillaje de formulación profesional que ofrece un acabado impecable y una duración superior a la media. Sus pigmentos de alta calidad garantizan colores vivos, precisos y estables a lo largo del día.`,
    parrafo2: () =>
      `Ideal para maquilladores profesionales y amantes del maquillaje. Disponible en Esencia de Belleza con envío rápido a toda España.`,
    keywords: ["maquillaje profesional", "base maquillaje profesional", "maquillaje larga duración"],
  },

  perfume: {
    titleSuffix: "— Perfume y Colonia",
    descTemplate: ({ nombre, marca }) =>
      `Perfume ${marca ? `${marca} ` : ""}${nombre}. Fragancia exclusiva de larga duración. Compra online con envío rápido.`,
    h2: "Fragancias exclusivas de larga duración",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es una fragancia de alta calidad con notas olfativas cuidadosamente seleccionadas para crear una experiencia sensorial única. Su formulación garantiza una duración prolongada sobre la piel.`,
    parrafo2: () =>
      `Disponible en Esencia de Belleza con envío rápido a toda España. El regalo perfecto o tu fragancia del día a día.`,
    keywords: ["perfume mujer", "colonia hombre", "fragancia exclusiva", "eau de parfum"],
  },

  cera_barbero: {
    titleSuffix: "— Cera de Barbería",
    descTemplate: ({ nombre, marca }) =>
      `Cera de barbero ${marca ? `${marca} ` : ""}${nombre}. Fijación y estilo para el cabello masculino. Envío rápido España.`,
    h2: "Ceras y pomadas de barbería para el estilo masculino",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es una cera o pomada de uso profesional en barbería diseñada para modelar, fijar y dar brillo al cabello masculino. Su textura maleable permite crear desde looks naturales hasta peinados estructurados con acabado brillante o mate.`,
    parrafo2: () =>
      `Aplica una pequeña cantidad sobre el cabello seco o ligeramente húmedo y peina al gusto. Disponible en Esencia de Belleza con envío rápido a toda España.`,
    keywords: ["cera barbero profesional", "pomada cabello hombre", "styling barbería", "cera pelo hombre"],
  },

  afeitado: {
    titleSuffix: "— Afeitado Profesional",
    descTemplate: ({ nombre, marca }) =>
      `${marca ? `${marca} ` : ""}${nombre}: productos de afeitado profesional. Suavidad y precisión. Envío rápido España.`,
    h2: "Productos de afeitado profesional para barbería",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es un producto de afeitado de uso profesional en barbería que proporciona un deslizamiento suave de la hoja, minimizando la irritación y los cortes. Su fórmula con activos calmantes prepara, cuida y regenera la piel antes, durante y después del afeitado.`,
    parrafo2: () =>
      `Imprescindible en cualquier barbería profesional. Disponible en Esencia de Belleza con envío rápido a toda España.`,
    keywords: ["crema afeitar profesional", "gel afeitado barbería", "productos afeitado hombre"],
  },

  coloracion_barba: {
    titleSuffix: "— Coloración de Barba",
    descTemplate: ({ nombre, marca }) =>
      `Tinte para barba ${marca ? `${marca} ` : ""}${nombre}. Cobertura de canas y color duradero. Envío rápido en España.`,
    h2: "Coloración profesional para barba y bigote",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es un producto de coloración específicamente formulado para barba y bigote. Cubre las canas de forma uniforme y ofrece un color natural y duradero sin dañar la piel ni el vello facial.`,
    parrafo2: () =>
      `Fácil de aplicar, con resultados visibles en pocos minutos. Disponible en Esencia de Belleza con envío rápido a toda España.`,
    keywords: ["tinte barba profesional", "coloración barba", "cobertura canas barba"],
  },

  otro: {
    titleSuffix: "",
    descTemplate: ({ nombre, marca, fragmentoDesc }) =>
      fragmentoDesc
        ? `${marca ? `${marca} ` : ""}${nombre}: ${fragmentoDesc} Envío rápido en España.`
        : `Compra ${nombre}${marca ? ` de ${marca}` : ""} en Esencia de Belleza. Productos profesionales con envío rápido en España.`,
    h2: "Producto de belleza y peluquería profesional",
    parrafo1: ({ nombre, marca }) =>
      `${nombre}${marca ? ` de ${marca}` : ""} es un producto de belleza o peluquería profesional disponible en Esencia de Belleza. Formulado con los más altos estándares de calidad para garantizar resultados óptimos tanto en uso profesional como doméstico.`,
    parrafo2: () =>
      `Disponible con envío rápido a toda España. Descubre nuestra amplia selección de productos profesionales de peluquería, estética y barbería.`,
    keywords: ["productos belleza profesional", "peluquería profesional", "estética profesional"],
  },
};

// ─── Función principal ────────────────────────────────────────────────────────

export function generarSeoProducto(input: InputProductoSeo): OutputSeo {
  const { nombre, marca, categoria, subcategoria, descripcion } = input;
  const marcaStr = marca ?? "";

  const tipo = detectarTipo(categoria, subcategoria);
  const plantilla = PLANTILLAS[tipo];

  const fragmentoDesc = extractoDescripcion(descripcion, 80);

  const ctx: TemplateCtx = {
    nombre,
    marca: marcaStr,
    categoria,
    subcategoria: subcategoria ?? "",
    fragmentoDesc,
  };

  // ── seo_title ──────────────────────────────────────────────────────────────
  // Formato: "[Marca] [Nombre] [Sufijo] | Esencia de Belleza"
  // Si supera 60 chars, truncamos el nombre progresivamente
  const SITE_SUFFIX = " | Esencia de Belleza";
  let title = "";

  if (marcaStr) {
    title = `${marcaStr} ${nombre}${plantilla.titleSuffix ? ` ${plantilla.titleSuffix}` : ""}${SITE_SUFFIX}`;
    if (title.length > 60) {
      // Sin sufijo
      title = `${marcaStr} ${nombre}${SITE_SUFFIX}`;
    }
    if (title.length > 60) {
      // Truncar nombre
      const maxNombre = 60 - SITE_SUFFIX.length - marcaStr.length - 1;
      title = `${marcaStr} ${nombre.slice(0, maxNombre)}${SITE_SUFFIX}`;
    }
  } else {
    title = `${nombre}${plantilla.titleSuffix ? ` ${plantilla.titleSuffix}` : ""}${SITE_SUFFIX}`;
    if (title.length > 60) {
      title = `${nombre}${SITE_SUFFIX}`;
    }
    if (title.length > 60) {
      const maxNombre = 60 - SITE_SUFFIX.length;
      title = `${nombre.slice(0, maxNombre)}${SITE_SUFFIX}`;
    }
  }

  // ── seo_description ────────────────────────────────────────────────────────
  let description = plantilla.descTemplate(ctx);
  if (description.length > 155) description = description.slice(0, 152) + "...";

  // ── texto_enriquecido_seo ──────────────────────────────────────────────────
  const p1 = plantilla.parrafo1(ctx);
  const p2 = plantilla.parrafo2(ctx);

  // Incluir la descripción original si tiene contenido propio
  const descOriginalLimpia = descripcion ? stripHtml(descripcion).slice(0, 400) : "";
  const bloqueDescOriginal =
    descOriginalLimpia && descOriginalLimpia.length > 50
      ? `\n<h3>Descripción del producto</h3>\n<p>${descOriginalLimpia}</p>`
      : "";

  const textoEnriquecido = `<h2>${plantilla.h2}</h2>
<p>${p1}</p>
<p>${p2}</p>${bloqueDescOriginal}`;

  return {
    seo_title: title.slice(0, 60),
    seo_description: description.slice(0, 155),
    texto_enriquecido_seo: textoEnriquecido,
  };
}
