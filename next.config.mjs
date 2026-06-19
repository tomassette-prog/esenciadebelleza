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
      {
        source: "/marca/:slug",
        destination: "/marcas/:slug",
        permanent: true,
      },
      {
        source: "/blog/:slug",
        destination: "/blog/:slug",
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
