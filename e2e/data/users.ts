// Usuarios y datos fijos del seed (Fase 6.4).
//
// TODO lo de este archivo sale de `supabase/seed.sql` y existe solo tras un
// `supabase db reset`. Los UUID son fijos a propósito (convención por prefijo
// documentada en la cabecera del seed) para poder citarlos aquí sin
// consultarlos primero.

export type TestUser = {
  email: string;
  password: string;
  /** `profiles.display_name`, tal como lo pinta el menú de usuario. */
  displayName: string;
  id: string;
};

/** Contraseña de laboratorio de los 6 usuarios del seed. */
const PASSWORD = "MercadoTech123!";

export const BUYER1: TestUser = {
  email: "buyer1@mercadotech.test",
  password: PASSWORD,
  displayName: "María Fernanda Quispe",
  id: "a0000000-0000-0000-0000-000000000001",
};

/**
 * Comprador del pedido `pagado` del seed (c…03) y del multi-vendedor (c…04).
 * El flujo del vendedor lo necesita para comprobar que el cambio de estado se
 * ve desde el lado del comprador.
 */
export const BUYER2: TestUser = {
  email: "buyer2@mercadotech.test",
  password: PASSWORD,
  displayName: "Jorge Luis Ramírez",
  id: "a0000000-0000-0000-0000-000000000002",
};

/** TecnoStore Perú: dueño de 8 productos, ninguno con pedido en 'pagado'. */
export const SELLER1: TestUser = {
  email: "seller1@mercadotech.test",
  password: PASSWORD,
  displayName: "TecnoStore Perú",
  id: "a0000000-0000-0000-0000-000000000004",
};

/**
 * GamerZone Lima. Es el vendedor del ÚNICO pedido en estado 'pagado' del seed
 * (c…03), así que es el que usa el E2E del kanban — verificado leyendo el
 * seed, no asumido.
 */
export const SELLER2: TestUser = {
  email: "seller2@mercadotech.test",
  password: PASSWORD,
  displayName: "GamerZone Lima",
  id: "a0000000-0000-0000-0000-000000000005",
};

/** Productos del seed que los specs citan por id. */
export const SEED_PRODUCTS = {
  /** Laptop Lenovo IdeaPad Slim 3, categoría Laptops, stock 8. */
  laptopConStock: "b0000000-0000-0000-0000-000000000001",
  /** Monitor Samsung Odyssey: ACTIVO pero con stock 0 — el negativo del carrito. */
  sinStock: "b0000000-0000-0000-0000-000000000006",
} as const;

/** Pedidos del seed que los specs citan por id. */
export const SEED_ORDERS = {
  /**
   * Único pedido en 'pagado': comprador buyer2, vendedor seller2, 1 ítem
   * (Samsung Galaxy A54). Es el que el kanban mueve a 'enviado'.
   */
  pagadoDeSeller2: "c0000000-0000-0000-0000-000000000003",
  /** Multi-vendedor en 'enviado' (seller2 + seller1): el negativo del retroceso. */
  enviadoMultiVendedor: "c0000000-0000-0000-0000-000000000004",
} as const;

/** Categoría con la que se prueba el filtrado del catálogo. */
export const SEED_CATEGORY_LAPTOPS = { slug: "laptops", name: "Laptops" } as const;
