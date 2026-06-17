// ─── Producto Padre ───────────────────────────────────────────────────────────
export interface ProductoPadre {
  id: string;
  nombre: string;
  slug: string;
  marca_id: string | null;
  marca?: Marca;
  descripcion_general: string | null;
  categoria: string;
  subcategoria: string | null;
  seo_title: string | null;
  seo_description: string | null;
  texto_enriquecido_seo: string | null;
  imagen_principal_url: string | null;
  activo: boolean;
  destacado: boolean;
  nuevo: boolean;
  variaciones?: ProductoVariacion[];
  created_at: string;
  updated_at: string;
}

// ─── Variación / Producto Hijo ────────────────────────────────────────────────
export interface ProductoVariacion {
  id: string;
  producto_padre_id: string;
  sku: string;
  nombre_variacion: string;
  ean_code: string | null;
  precio_b2c: number;
  precio_b2b: number | null;
  precio_comparar: number | null;
  stock: number;
  stock_minimo: number;
  ubicacion_almacen: string | null;
  imagen_url: string | null;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Marca ────────────────────────────────────────────────────────────────────
export interface Marca {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
  activa: boolean;
}

// ─── Producto con variaciones (vista completa) ────────────────────────────────
export type ProductoCompleto = ProductoPadre & {
  variaciones: ProductoVariacion[];
  marca: Marca | null;
};

// ─── Item del catálogo (vista de lista) ──────────────────────────────────────
export type ProductoCatalogo = Pick<
  ProductoPadre,
  "id" | "nombre" | "slug" | "categoria" | "subcategoria" | "imagen_principal_url" | "destacado" | "nuevo"
> & {
  marca_nombre: string | null;
  precio_desde: number;        // precio mínimo B2C entre variaciones
  total_variaciones: number;
};

// ─── Perfil de usuario ────────────────────────────────────────────────────────
export interface PerfilUsuario {
  id: string;
  nombre_completo: string | null;
  empresa: string | null;
  nif_cif: string | null;
  telefono: string | null;
  tipo_cliente: "b2c" | "b2b";
  b2b_aprobado: boolean;
  created_at: string;
}

// ─── Pedido ───────────────────────────────────────────────────────────────────
export type EstadoPedido =
  | "pendiente"
  | "pagado"
  | "preparando"
  | "enviado"
  | "entregado"
  | "cancelado"
  | "reembolsado";

export interface Pedido {
  id: string;
  usuario_id: string | null;
  estado: EstadoPedido;
  subtotal: number;
  descuento: number;
  gastos_envio: number;
  total: number;
  tipo_precio: "b2c" | "b2b";
  metodo_pago: string | null;
  stripe_payment_id: string | null;
  paypal_order_id: string | null;
  direccion_envio: DireccionEnvio;
  email_cliente: string;
  notas: string | null;
  lineas?: LineaPedido[];
  created_at: string;
  updated_at: string;
}

export interface LineaPedido {
  id: string;
  pedido_id: string;
  variacion_id: string | null;
  sku: string;
  nombre_producto: string;
  nombre_variacion: string | null;
  imagen_url: string | null;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
}

export interface DireccionEnvio {
  nombre: string;
  apellidos: string;
  empresa?: string;
  calle: string;
  ciudad: string;
  provincia: string;
  codigo_postal: string;
  pais: string;
  telefono: string;
}

// ─── Carrito (estado cliente) ─────────────────────────────────────────────────
export interface ItemCarrito {
  variacion_id: string;
  sku: string;
  nombre_producto: string;
  nombre_variacion: string;
  imagen_url: string | null;
  precio: number;         // precio ya resuelto según tipo_cliente
  cantidad: number;
  stock_disponible: number;
}
