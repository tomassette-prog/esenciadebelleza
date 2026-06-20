/** @type {import('next').NextConfig} */
const nextConfig = {
  // ISR / SSR por defecto — sin generación estática innecesaria
  experimental: {
    ppr: false,
  },

  images: {
    // Dominios de origen para imágenes scrapeadas
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "depeluqueriaproductos.com",
      },
      {
        protocol: "https",
        hostname: "**.depeluqueriaproductos.com",
      },
      // Supabase Storage
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400, // 24h
  },

  // Compresión gzip/brotli en producción
  compress: true,

  // Redirects 301 desde URLs antiguas con link juice (se amplía en vercel.json)
  async redirects() {
    return [
      // Bloqueamos patrones legacy de CMS/PHP que no existen en Next.js
      {
        source: "/wp-admin/:path*",
        destination: "/404-legacy",
        permanent: false,
      },
      {
        source: "/:path*.php",
        destination: "/404-legacy",
        permanent: false,
      },
      // Redireccionamos la URL canónica antigua de tienda a /productos
      {
        source: "/tienda",
        destination: "/productos",
        permanent: true,
      },
      {
        source: "/shop",
        destination: "/productos",
        permanent: true,
      },
      // Sitemaps antiguos de WordPress → nuevo sitemap de Next.js (301 con link juice)
      {
        source: "/sitemap_index.xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
      {
        source: "/category-sitemap.xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
      {
        source: "/product-sitemap.xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
      {
        source: "/page-sitemap.xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
      {
        source: "/post-sitemap.xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
      // Rutas antiguas de WordPress / WooCommerce → equivalentes Next.js
      // (preservan link juice de backlinks al dominio expirado)
      {
        source: "/product-category/:path*",
        destination: "/productos/:path*",
        permanent: true,
      },
      {
        source: "/category/:slug",
        destination: "/productos",
        permanent: true,
      },
      {
        source: "/tag/:slug",
        destination: "/productos",
        permanent: true,
      },
      // Productos individuales de WooCommerce
      {
        source: "/product/:slug",
        destination: "/producto/:slug",
        permanent: true,
      },
      {
        source: "/tienda/:slug",
        destination: "/producto/:slug",
        permanent: true,
      },
      {
        source: "/shop/:slug",
        destination: "/producto/:slug",
        permanent: true,
      },
      // Marcas
      {
        source: "/marca/:slug",
        destination: "/marcas/:slug",
        permanent: true,
      },
      {
        source: "/brand/:slug",
        destination: "/marcas/:slug",
        permanent: true,
      },
      // Blog: URLs antiguas de WordPress
      {
        source: "/blog/category/:cat",
        destination: "/blog",
        permanent: true,
      },
      {
        source: "/blog/tag/:tag",
        destination: "/blog",
        permanent: true,
      },
      {
        source: "/noticias/:slug",
        destination: "/blog/:slug",
        permanent: true,
      },
      {
        source: "/articulo/:slug",
        destination: "/blog/:slug",
        permanent: true,
      },
      {
        source: "/post/:slug",
        destination: "/blog/:slug",
        permanent: true,
      },
      {
        source: "/consejos/:slug",
        destination: "/blog/:slug",
        permanent: true,
      },
      // Búsqueda
      {
        source: "/search",
        destination: "/buscar",
        permanent: true,
      },
      {
        source: "/busqueda",
        destination: "/buscar",
        permanent: true,
      },
      // Páginas estáticas de WordPress comunes
      {
        source: "/contacto",
        destination: "/sobre-nosotros",
        permanent: true,
      },
      {
        source: "/contact",
        destination: "/sobre-nosotros",
        permanent: true,
      },
      {
        source: "/quienes-somos",
        destination: "/sobre-nosotros",
        permanent: true,
      },
      {
        source: "/about",
        destination: "/sobre-nosotros",
        permanent: true,
      },
      {
        source: "/about-us",
        destination: "/sobre-nosotros",
        permanent: true,
      },
      // Políticas
      {
        source: "/privacy-policy",
        destination: "/privacidad",
        permanent: true,
      },
      {
        source: "/terminos",
        destination: "/aviso-legal",
        permanent: true,
      },
      {
        source: "/terms",
        destination: "/aviso-legal",
        permanent: true,
      },
    ];
  },

  // Headers de seguridad base (reforzados en vercel.json)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
