// Tests de services/seller.service.ts (Fase 6.3). Cliente inyectado.
//
// OJO con el reparto de responsabilidades: `updateOrderStatus` NO valida la
// secuencia del kanban — solo escribe el destino. La regla del orden vive en
// `hooks/useSellerOrders.ts` y se prueba en su propio archivo (decisión 4).

import { describe, expect, it } from "vitest";

import {
  ProductHasSalesError,
  createProduct,
  deleteProduct,
  listMyOrders,
  listMyProducts,
  toggleActive,
  updateOrderStatus,
  updateProduct,
} from "@/services/seller.service";
import { ORDER_STATUS_FLOW } from "@/lib/constants/orders";
import { dbError, hasFilter, mockSupabase } from "@/services/test-utils/supabase-mock";

const SELLER = "seller-1";

const filaProducto = {
  id: "p1",
  seller_id: SELLER,
  category_id: "c1",
  title: "Laptop Lenovo IdeaPad 3",
  description: null,
  brand: "Lenovo",
  condition: "nuevo",
  price: "2199.00",
  stock: 4,
  is_active: false,
  created_at: "2026-08-01T00:00:00Z",
  product_images: [{ image_path: "s1/p1/0.jpg", position: 0 }],
  reviews: [{ rating: 4 }],
};

describe("listMyProducts", () => {
  it("NO filtra por is_active: el dueño debe ver también los despublicados", async () => {
    const supabase = mockSupabase({ products: { select: [filaProducto] } });

    const products = await listMyProducts(SELLER, supabase);

    // Sin esto no habría forma de reactivar un producto desde el panel.
    expect(products[0].is_active).toBe(false);
    expect(hasFilter(supabase.filters("products"), "eq", "is_active")).toBe(false);
  });

  it("filtra por vendedor y ordena por fecha descendente", async () => {
    const supabase = mockSupabase({ products: { select: [] } });

    await listMyProducts(SELLER, supabase);

    const [call] = supabase.calls("products");
    expect(hasFilter(call.filters, "eq", "seller_id", SELLER)).toBe(true);
    expect(call.orders).toEqual([{ column: "created_at", ascending: false }]);
  });

  it("mapea price a number, portada y agregados igual que el catálogo público", async () => {
    const supabase = mockSupabase({ products: { select: [filaProducto] } });

    const [product] = await listMyProducts(SELLER, supabase);

    expect(product.price).toBe(2199);
    expect(product.image_url).toContain("product-images/s1/p1/0.jpg");
    expect(product.average_rating).toBe(4);
    expect(product.review_count).toBe(1);
  });

  it("sin reseñas ni imágenes deja null en ambos", async () => {
    const supabase = mockSupabase({
      products: { select: [{ ...filaProducto, product_images: null, reviews: null }] },
    });

    const [product] = await listMyProducts(SELLER, supabase);

    expect(product.image_url).toBeNull();
    expect(product.average_rating).toBeNull();
    expect(product.review_count).toBe(0);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ products: { select: dbError("boom") } });

    await expect(listMyProducts(SELLER, supabase)).rejects.toThrow("boom");
  });
});

describe("createProduct / updateProduct / toggleActive", () => {
  const payload = {
    title: "Mouse Logitech",
    description: null,
    brand: "Logitech",
    category_id: "c2",
    condition: "nuevo" as const,
    price: 89.9,
    stock: 10,
  };

  it("createProduct pega el seller_id al payload y devuelve el id nuevo", async () => {
    const supabase = mockSupabase({ products: { single: { id: "p-nuevo" } } });

    await expect(createProduct(SELLER, payload, supabase)).resolves.toBe("p-nuevo");
    expect(supabase.inserts("products")).toEqual([{ ...payload, seller_id: SELLER }]);
  });

  it("createProduct propaga el error", async () => {
    const supabase = mockSupabase({ products: { single: dbError("violates check constraint", "23514") } });

    await expect(createProduct(SELLER, payload, supabase)).rejects.toThrow(
      "violates check constraint",
    );
  });

  it("updateProduct escribe solo los campos recibidos, filtrando por id", async () => {
    const supabase = mockSupabase();

    await updateProduct("p1", { price: 1999 }, supabase);

    expect(supabase.updates("products")).toEqual([{ price: 1999 }]);
    expect(hasFilter(supabase.filters("products"), "eq", "id", "p1")).toBe(true);
  });

  it("updateProduct propaga el error", async () => {
    const supabase = mockSupabase({ products: { update: dbError("row-level security") } });

    await expect(updateProduct("p1", { stock: 1 }, supabase)).rejects.toThrow("row-level security");
  });

  it.each([[true], [false]])("toggleActive escribe is_active = %s", async (isActive) => {
    const supabase = mockSupabase();

    await toggleActive("p1", isActive, supabase);

    expect(supabase.updates("products")).toEqual([{ is_active: isActive }]);
  });

  it("toggleActive propaga el error", async () => {
    const supabase = mockSupabase({ products: { update: dbError("boom") } });

    await expect(toggleActive("p1", true, supabase)).rejects.toThrow("boom");
  });
});

describe("deleteProduct", () => {
  it("borra por id cuando el producto no tiene ventas", async () => {
    const supabase = mockSupabase();

    await deleteProduct("p1", supabase);

    expect(supabase.deletes("products")).toBe(1);
    expect(hasFilter(supabase.filters("products"), "eq", "id", "p1")).toBe(true);
  });

  it("traduce el 23503 de la FK a un error de dominio con mensaje accionable", async () => {
    const supabase = mockSupabase({
      products: { delete: dbError("violates foreign key constraint", "23503") },
    });

    // La UI no debe mostrar jerga de Postgres: le sugiere desactivar.
    await expect(deleteProduct("p1", supabase)).rejects.toBeInstanceOf(ProductHasSalesError);
    await expect(deleteProduct("p1", supabase)).rejects.toThrow(
      "Este producto tiene ventas; desactívalo en lugar de eliminarlo.",
    );
  });

  it("cualquier otro error se propaga tal cual", async () => {
    const supabase = mockSupabase({
      products: { delete: dbError("permission denied for table products", "42501") },
    });

    await expect(deleteProduct("p1", supabase)).rejects.toThrow(
      "permission denied for table products",
    );
    await expect(deleteProduct("p1", supabase)).rejects.not.toBeInstanceOf(ProductHasSalesError);
  });
});

describe("listMyOrders", () => {
  const item = (over: Partial<Record<string, unknown>> = {}) => ({
    id: "i1",
    order_id: "o1",
    title_snapshot: "Laptop Lenovo",
    quantity: 2,
    price_snapshot: "1000.00",
    orders: { id: "o1", status: "pagado", created_at: "2026-08-20T10:00:00Z" },
    ...over,
  });

  it("parte de order_items, no de orders: cada vendedor ve solo lo suyo", async () => {
    const supabase = mockSupabase({ order_items: { select: [item()] } });

    await listMyOrders(SELLER, supabase);

    expect(supabase.calls("order_items")).toHaveLength(1);
    expect(supabase.calls("orders")).toHaveLength(0);
    expect(hasFilter(supabase.filters("order_items"), "eq", "seller_id", SELLER)).toBe(true);
  });

  it("agrupa varios ítems del mismo pedido y suma SU total, no el del pedido", async () => {
    const supabase = mockSupabase({
      order_items: {
        select: [
          item(),
          item({ id: "i2", title_snapshot: "Mouse", quantity: 1, price_snapshot: "89.90" }),
        ],
      },
    });

    const [order] = await listMyOrders(SELLER, supabase);

    expect(order.items).toHaveLength(2);
    // 1000 × 2 + 89.90 × 1
    expect(order.myTotal).toBeCloseTo(2089.9, 2);
  });

  it("separa pedidos distintos y los ordena del más reciente al más antiguo", async () => {
    const supabase = mockSupabase({
      order_items: {
        select: [
          item({ order_id: "viejo", orders: { id: "viejo", status: "enviado", created_at: "2026-01-01T00:00:00Z" } }),
          item({ id: "i2", order_id: "nuevo", orders: { id: "nuevo", status: "pagado", created_at: "2026-08-30T00:00:00Z" } }),
        ],
      },
    });

    const orders = await listMyOrders(SELLER, supabase);

    expect(orders.map((o) => o.id)).toEqual(["nuevo", "viejo"]);
  });

  it("convierte price_snapshot a number", async () => {
    const supabase = mockSupabase({ order_items: { select: [item()] } });

    const [order] = await listMyOrders(SELLER, supabase);

    expect(order.items[0].price_snapshot).toBe(1000);
    expect(typeof order.items[0].price_snapshot).toBe("number");
  });

  it("sin ítems devuelve lista vacía", async () => {
    await expect(listMyOrders(SELLER, mockSupabase())).resolves.toEqual([]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ order_items: { select: dbError("boom") } });

    await expect(listMyOrders(SELLER, supabase)).rejects.toThrow("boom");
  });
});

describe("updateOrderStatus", () => {
  it.each(ORDER_STATUS_FLOW)("envía el status destino %s sin más", async (status) => {
    const supabase = mockSupabase();

    await updateOrderStatus("o1", status, supabase);

    expect(supabase.updates("orders")).toEqual([{ status }]);
    expect(hasFilter(supabase.filters("orders"), "eq", "id", "o1")).toBe(true);
  });

  it("NO valida la secuencia: acepta retroceder, porque esa regla vive en el hook", async () => {
    const supabase = mockSupabase();

    // La RLS valida el DESTINO (pagado/enviado/entregado), no el orden. Que
    // esto pase sin error es justamente por qué existe validateTransition.
    await expect(updateOrderStatus("o1", "pagado", supabase)).resolves.toBeUndefined();
    expect(supabase.updates("orders")).toEqual([{ status: "pagado" }]);
  });

  it("propaga el error de la RLS cuando el destino no está permitido", async () => {
    const supabase = mockSupabase({
      orders: { update: dbError("new row violates row-level security policy for table \"orders\"", "42501") },
    });

    await expect(updateOrderStatus("o1", "cancelado", supabase)).rejects.toThrow(
      "new row violates row-level security policy",
    );
  });
});
