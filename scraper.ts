import { chromium, Browser, Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Variacion {
  nombre: string;
  precio: string | null;
  imagen: string | null;
}

interface Producto {
  nombre: string;
  marca: string | null;
  descripcion: string | null;
  categoria: string;
  subcategoria: string | null;
  url: string;
  imagen_principal: string | null;
  precio_base: string | null;
  variaciones: Variacion[];
}

interface CategoriaLink {
  nombre: string;
  url: string;
  subcategoria: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const BASE_URL = "https://www.depeluqueriaproductos.com";

// ─── Obtener categorías del menú principal ────────────────────────────────────

async function obtenerCategorias(page: Page): Promise<CategoriaLink[]> {
  console.log(" Extrayendo categorías del menú...");
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(1000);

  const categorias = await page.evaluate(() => {
    const links: { nombre: string; url: string; subcategoria: string | null }[] = [];
    const seen = new Set<string>();

    // Intentar menú de navegación principal
    const menuItems = document.querySelectorAll(
      "nav a, .nav a, #menu a, .menu a, .navigation a, header a, .header a, .categories a"
    );

    menuItems.forEach((el) => {
      const anchor = el as HTMLAnchorElement;
      const href = anchor.href;
      const texto = anchor.textContent?.trim() ?? "";

      if (
        href &&
        href.includes(window.location.hostname) &&
        texto.length > 0 &&
        !seen.has(href) &&
        !href.includes("login") &&
        !href.includes("cuenta") &&
        !href.includes("carrito") &&
        !href.includes("contacto")
      ) {
        seen.add(href);
        links.push({ nombre: texto, url: href, subcategoria: null });
      }
    });

    return links;
  });

  if (categorias.length === 0) {
    // Fallback: buscar todos los enlaces que parezcan categorías de producto
    const fallback = await page.evaluate(() => {
      const links: { nombre: string; url: string; subcategoria: string | null }[] = [];
      const seen = new Set<string>();
      document.querySelectorAll("a").forEach((a) => {
        const href = a.href;
        const texto = a.textContent?.trim() ?? "";
        if (
          href &&
          href.includes(window.location.hostname) &&
          texto.length > 2 &&
          texto.length < 60 &&
          !seen.has(href)
        ) {
          seen.add(href);
          links.push({ nombre: texto, url: href, subcategoria: null });
        }
      });
      return links;
    });
    return fallback;
  }

  return categorias;
}

// ─── Obtener URLs de productos en una página de categoría ────────────────────

async function obtenerUrlsProductos(page: Page, urlCategoria: string): Promise<string[]> {
  const urls: string[] = [];
  let paginaActual = urlCategoria;
  let seguirPaginando = true;

  while (seguirPaginando) {
    try {
      await page.goto(paginaActual, { waitUntil: "domcontentloaded", timeout: 30000 });
      await delay(1000);
    } catch {
      console.warn(`    Error al cargar ${paginaActual}`);
      break;
    }

    const productLinks = await page.evaluate(() => {
      const links = new Set<string>();
      // Selectores comunes de PrestaShop / WooCommerce / Shopify
      const selectors = [
        ".product-miniature a.product-thumbnail",
        ".product_list .product-name a",
        ".products .product a",
        "article.product_item a",
        ".item-product a.product-name",
        "h2.product-title a",
        ".product-title a",
        "a.product_img_link",
        ".thumbnail-container a",
        ".product-image-container a",
        "[data-id-product] a",
      ];
      selectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          const a = el as HTMLAnchorElement;
          if (a.href) links.add(a.href);
        });
      });
      return Array.from(links);
    });

    if (productLinks.length === 0) {
      // Fallback: si no encontramos con selectores típicos, buscar por URL patterns
      const fallbackLinks = await page.evaluate(() => {
        const links = new Set<string>();
        document.querySelectorAll("a[href]").forEach((el) => {
          const a = el as HTMLAnchorElement;
          if (
            a.href.includes("/producto/") ||
            a.href.includes("/products/") ||
            a.href.match(/\/[^/]+-p\d+\.html/) ||
            a.href.match(/id_product=\d+/)
          ) {
            links.add(a.href);
          }
        });
        return Array.from(links);
      });
      urls.push(...fallbackLinks);
    } else {
      urls.push(...productLinks);
    }

    // Paginación
    const nextUrl = await page.evaluate(() => {
      const next = document.querySelector(
        "a[rel='next'], .next a, .pagination .next a, li.next a, a.next"
      ) as HTMLAnchorElement | null;
      return next ? next.href : null;
    });

    if (nextUrl && nextUrl !== paginaActual) {
      paginaActual = nextUrl;
      console.log(`    ↪ Página siguiente: ${nextUrl}`);
    } else {
      seguirPaginando = false;
    }
  }

  // Eliminar duplicados
  return [...new Set(urls)];
}

// ─── Extraer datos de un producto individual ──────────────────────────────────

async function extraerProducto(
  page: Page,
  url: string,
  categoria: string,
  subcategoria: string | null
): Promise<Producto | null> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(800);
  } catch {
    console.warn(`    No se pudo cargar: ${url}`);
    return null;
  }

  const datos = await page.evaluate(() => {
    // ── Nombre ──
    const nombre =
      (document.querySelector("h1.product_name, h1.product-name, h1[itemprop='name'], h1") as HTMLElement | null)
        ?.innerText?.trim() ?? null;

    // ── Marca ──
    const marca =
      (document.querySelector(
        "[itemprop='brand'], .manufacturer a, .brand a, .product-manufacturer a, .product-brand"
      ) as HTMLElement | null)?.innerText?.trim() ?? null;

    // ── Descripción ──
    const descripcion =
      (document.querySelector(
        "[itemprop='description'], #product-description-short, .product-description, .product_description, #description .rte"
      ) as HTMLElement | null)?.innerText?.trim() ?? null;

    // ── Precio base ──
    const precioEl = document.querySelector(
      "[itemprop='price'], .price, .product-price span, span.price"
    ) as HTMLElement | null;
    const precio_base =
      precioEl?.getAttribute("content") ??
      precioEl?.innerText?.trim() ??
      null;

    // ── Imagen principal ──
    const imgEl = document.querySelector(
      "#bigpic, .zoomWrapper img, .product-cover img, [itemprop='image'], .product_img_link img"
    ) as HTMLImageElement | null;
    const imagen_principal =
      imgEl?.getAttribute("data-image-large-src") ??
      imgEl?.getAttribute("data-zoom-image") ??
      imgEl?.src ??
      null;

    return { nombre, marca, descripcion, precio_base, imagen_principal };
  });

  if (!datos.nombre) {
    console.warn(`    Sin nombre en: ${url}`);
    return null;
  }

  // ── Variaciones ──────────────────────────────────────────────────────────────
  const variaciones = await extraerVariaciones(page, url);

  return {
    nombre: datos.nombre,
    marca: datos.marca,
    descripcion: datos.descripcion,
    categoria,
    subcategoria,
    url,
    imagen_principal: datos.imagen_principal,
    precio_base: datos.precio_base,
    variaciones,
  };
}

// ─── Extraer variaciones (tonos / colores / tamaños) ──────────────────────────

async function extraerVariaciones(page: Page, _url: string): Promise<Variacion[]> {
  const variaciones: Variacion[] = [];

  // Detectar si hay atributos de tipo select/radio/color swatch
  const tieneVariaciones = await page.evaluate(() => {
    return !!(
      document.querySelector(
        "#product_customization_id, select[name*='group'], .attribute-group select, " +
        ".product-variants select, .product-options select, " +
        ".color-pick, .swatches, [data-product-attribute], " +
        "input[name*='group'], .product_attributes select"
      )
    );
  });

  if (!tieneVariaciones) return variaciones;

  // ── Caso SELECT (dropdown de tonos/tamaños) ──────────────────────────────────
  const selectData = await page.evaluate(() => {
    const results: { nombre: string; value: string }[][] = [];
    const selects = document.querySelectorAll(
      "select[name*='group'], .attribute-group select, .product-variants select, .product_attributes select"
    );
    selects.forEach((sel) => {
      const options: { nombre: string; value: string }[] = [];
      sel.querySelectorAll("option").forEach((opt) => {
        const o = opt as HTMLOptionElement;
        if (o.value && o.value !== "" && o.value !== "0") {
          options.push({ nombre: o.textContent?.trim() ?? o.value, value: o.value });
        }
      });
      if (options.length > 0) results.push(options);
    });
    return results;
  });

  // Si hay selects, iterar por cada combinación del primer select
  if (selectData.length > 0) {
    const primerSelect = selectData[0];

    for (const opcion of primerSelect) {
      try {
        // Seleccionar la opción en el desplegable
        await page.selectOption(
          "select[name*='group'], .attribute-group select, .product-variants select, .product_attributes select",
          { label: opcion.nombre }
        );
        await delay(600);

        // Leer precio e imagen tras el cambio
        const datosPrecio = await page.evaluate(() => {
          const precioEl = document.querySelector(
            "[itemprop='price'], .price, .product-price span, span.price"
          ) as HTMLElement | null;
          const precio =
            precioEl?.getAttribute("content") ??
            precioEl?.innerText?.trim() ??
            null;

          const imgEl = document.querySelector(
            "#bigpic, .zoomWrapper img, .product-cover img, [itemprop='image']"
          ) as HTMLImageElement | null;
          const imagen =
            imgEl?.getAttribute("data-image-large-src") ??
            imgEl?.getAttribute("data-zoom-image") ??
            imgEl?.src ??
            null;

          return { precio, imagen };
        });

        variaciones.push({
          nombre: opcion.nombre,
          precio: datosPrecio.precio,
          imagen: datosPrecio.imagen,
        });
      } catch {
        variaciones.push({ nombre: opcion.nombre, precio: null, imagen: null });
      }
    }
    return variaciones;
  }

  // ── Caso RADIO / COLOR SWATCHES ───────────────────────────────────────────────
  const swatchData = await page.evaluate(() => {
    const items: { nombre: string; selector: string }[] = [];
    const swatches = document.querySelectorAll(
      ".color-pick a, .swatches a, [data-product-attribute] li, " +
      "input[name*='group'][type='radio'], .attribute_list li"
    );
    swatches.forEach((el, i) => {
      const nombre =
        el.getAttribute("title") ??
        el.getAttribute("data-value-name") ??
        (el as HTMLElement).innerText?.trim() ??
        `Variante ${i + 1}`;
      items.push({ nombre, selector: `:nth-child(${i + 1})` });
    });
    return items;
  });

  if (swatchData.length > 0) {
    const swatchEls = await page.$$(
      ".color-pick a, .swatches a, [data-product-attribute] li, " +
      "input[name*='group'][type='radio'], .attribute_list li"
    );

    for (let i = 0; i < swatchEls.length; i++) {
      const el = swatchEls[i];
      const nombre = swatchData[i]?.nombre ?? `Variante ${i + 1}`;
      try {
        await el.click();
        await delay(600);

        const datosPrecio = await page.evaluate(() => {
          const precioEl = document.querySelector(
            "[itemprop='price'], .price, .product-price span, span.price"
          ) as HTMLElement | null;
          const precio =
            precioEl?.getAttribute("content") ??
            precioEl?.innerText?.trim() ??
            null;

          const imgEl = document.querySelector(
            "#bigpic, .zoomWrapper img, .product-cover img, [itemprop='image']"
          ) as HTMLImageElement | null;
          const imagen =
            imgEl?.getAttribute("data-image-large-src") ??
            imgEl?.getAttribute("data-zoom-image") ??
            imgEl?.src ??
            null;

          return { precio, imagen };
        });

        variaciones.push({ nombre, precio: datosPrecio.precio, imagen: datosPrecio.imagen });
      } catch {
        variaciones.push({ nombre, precio: null, imagen: null });
      }
    }
  }

  return variaciones;
}

// ─── Función principal ────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const browser: Browser = await chromium.launch({ headless: true });
  const page: Page = await browser.newPage();

  // User-agent real para evitar bloqueos
  await page.setExtraHTTPHeaders({
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/124.0.0.0 Safari/537.36",
  });

  const catalogo: Producto[] = [];
  const urlsProductosProcesadas = new Set<string>();

  try {
    // 1. Obtener categorías
    const todasCategorias = await obtenerCategorias(page);
    console.log(` ${todasCategorias.length} links encontrados en el menú`);

    // Filtrar solo los que parecen categorías de productos
    const categoriasFiltradas = todasCategorias.filter((c) => {
      const url = c.url.toLowerCase();
      return (
        !url.endsWith(BASE_URL + "/") &&
        url !== BASE_URL &&
        !url.includes("#") &&
        !url.includes("javascript") &&
        (url.includes("/categoria") ||
          url.includes("/category") ||
          url.includes("/tienda") ||
          url.includes("/shop") ||
          url.includes("/marcas") ||
          url.includes("/products") ||
          // Si no podemos deducir, incluir todos los links del mismo dominio
          url.startsWith(BASE_URL))
      );
    });

    // Deduplicar
    const categoriasUnicas = categoriasFiltradas.filter(
      (c, i, arr) => arr.findIndex((x) => x.url === c.url) === i
    );

    console.log(` Categorías a procesar: ${categoriasUnicas.length}`);

    // 2. Por cada categoría, extraer URLs de productos
    for (const cat of categoriasUnicas) {
      console.log(`\n  Categoría: ${cat.nombre} → ${cat.url}`);
      let urlsProductos: string[] = [];

      try {
        urlsProductos = await obtenerUrlsProductos(page, cat.url);
      } catch (err) {
        console.warn(`    Error obteniendo productos de ${cat.url}: ${err}`);
        continue;
      }

      console.log(`   ${urlsProductos.length} productos encontrados`);

      // 3. Por cada URL de producto, extraer datos
      for (const urlProducto of urlsProductos) {
        if (urlsProductosProcesadas.has(urlProducto)) {
          continue; // ya procesado en otra categoría
        }
        urlsProductosProcesadas.add(urlProducto);

        console.log(`     ${urlProducto}`);
        const producto = await extraerProducto(page, urlProducto, cat.nombre, cat.subcategoria);

        if (producto) {
          catalogo.push(producto);
          console.log(
            `     "${producto.nombre}" — ${producto.variaciones.length} variación(es)`
          );
        }

        await delay(1000); // pausa educada entre productos
      }

      await delay(1000); // pausa entre categorías
    }
  } finally {
    await browser.close();
  }

  // 4. Guardar JSON
  const outputPath = path.resolve(__dirname, "catalogo_esencia.json");
  fs.writeFileSync(outputPath, JSON.stringify(catalogo, null, 2), "utf-8");

  console.log(`\n Scraping completado.`);
  console.log(`   Total productos: ${catalogo.length}`);
  console.log(`   Archivo guardado en: ${outputPath}`);
}

main().catch((err) => {
  console.error(" Error fatal:", err);
  process.exit(1);
});
