// Tests de services/cart.service.ts (Fase 6.3).
//
// El cliente se INYECTA por el último parámetro: no hay `vi.mock` de
// `lib/supabase/*` en ningún punto de este archivo, y la suite pasa con
// Docker apagado.
//
// ANCLA IMPORTANTE (decisión 5 de la spec): `addItem` NO rechaza cantidades
// raras. Suma la cantidad al duplicado y recorta el total a `[1, stock]`. Los
// tests documentan ese contrato real, no el que uno esperaría de memoria.

import { describe, expect, it } from "vitest";

import {
  addItem,
  clear,
  getItems,
  removeItem,
  updateQuantity,
} from "@/services/cart.service";
import { dbError, hasFilter, mockSupabase } from "@/services/test-utils/supabase-mock";

const USER = "u1";
const PRODUCT = "p1";

describe("addItem — producto nuevo en el carrito", () => {
  it("inserta la fila con la cantidad pedida", async () => {
    const supabase = mockSupabase({
      cart_items: { maybeSingle: null },
      products: { single: { stock: 10 } },
    });

    await addItem(USER, PRODUCT, 2, supabase);

    expect(supabase.inserts("cart_items")).toEqual([
      { user_id: USER, product_id: PRODUCT, quantity: 2 },
    ]);
    expect(supabase.updates("cart_items")).toEqual([]);
  });

  it("recorta al stock disponible al insertar", async () => {
    const supabase = mockSupabase({
      cart_items: { maybeSingle: null },
      products: { single: { stock: 3 } },
    });

    await addItem(USER, PRODUCT, 99, supabase);

    expect(supabase.inserts("cart_items")).toEqual([
      { user_id: USER, product_id: PRODUCT, quantity: 3 },
    ]);
  });

  it("busca la fila existente por usuario Y producto", async () => {
    const supabase = mockSupabase({
      cart_items: { maybeSingle: null },
      products: { single: { stock: 5 } },
    });

    await addItem(USER, PRODUCT, 1, supabase);

    const lectura = supabase.calls("cart_items")[0];
    expect(hasFilter(lectura.filters, "eq", "user_id", USER)).toBe(true);
    expect(hasFilter(lectura.filters, "eq", "product_id", PRODUCT)).toBe(true);
  });
});

describe("addItem — duplicado", () => {
  it("suma la cantidad y recorta al stock", async () => {
    const supabase = mockSupabase({
      cart_items: { maybeSingle: { id: "c1", quantity: 3 } },
      products: { single: { stock: 4 } },
    });

    await addItem(USER, PRODUCT, 5, supabase);

    // 3 + 5 = 8, con tope 4. No es un rechazo: es un recorte.
    expect(supabase.updates("cart_items")).toContainEqual({ quantity: 4 });
    expect(supabase.inserts("cart_items")).toEqual([]);
  });

  it("suma sin recortar cuando el stock alcanza", async () => {
    const supabase = mockSupabase({
      cart_items: { maybeSingle: { id: "c1", quantity: 1 } },
      products: { single: { stock: 10 } },
    });

    await addItem(USER, PRODUCT, 2, supabase);

    expect(supabase.updates("cart_items")).toEqual([{ quantity: 3 }]);
  });

  it("actualiza por el id de la fila, no por usuario/producto", async () => {
    const supabase = mockSupabase({
      cart_items: { maybeSingle: { id: "c1", quantity: 1 } },
      products: { single: { stock: 10 } },
    });

    await addItem(USER, PRODUCT, 1, supabase);

    const escritura = supabase.calls("cart_items")[1];
    expect(hasFilter(escritura.filters, "eq", "id", "c1")).toBe(true);
  });
});

describe("addItem — el piso es 1, no un rechazo", () => {
  it.each([[0], [-5]])("cantidad %i termina en 1 en un producto nuevo", async (quantity) => {
    const supabase = mockSupabase({
      cart_items: { maybeSingle: null },
      products: { single: { stock: 10 } },
    });

    // Se esperaría un error; el código real recorta a 1 (decisión 5).
    await expect(addItem(USER, PRODUCT, quantity, supabase)).resolves.toBeUndefined();
    expect(supabase.inserts("cart_items")).toEqual([
      { user_id: USER, product_id: PRODUCT, quantity: 1 },
    ]);
  });

  it("una cantidad negativa sobre un duplicado también cae al piso 1", async () => {
    const supabase = mockSupabase({
      cart_items: { maybeSingle: { id: "c1", quantity: 2 } },
      products: { single: { stock: 10 } },
    });

    await addItem(USER, PRODUCT, -10, supabase);

    // 2 + (-10) = -8 → Math.max(1, …) = 1. Restar del carrito por esta vía
    // no borra la fila: la deja en 1.
    expect(supabase.updates("cart_items")).toEqual([{ quantity: 1 }]);
  });

  it("el piso gana incluso si el producto está agotado", async () => {
    const supabase = mockSupabase({
      cart_items: { maybeSingle: null },
      products: { single: { stock: 0 } },
    });

    await addItem(USER, PRODUCT, 1, supabase);

    // comportamiento actual, revisar: con stock 0 el piso 1 gana al tope 0 y
    // el carrito acepta una unidad que el checkout va a rechazar. La UI lo
    // evita deshabilitando el botón (cubierto por el E2E negativo de la 6.5).
    expect(supabase.inserts("cart_items")).toEqual([
      { user_id: USER, product_id: PRODUCT, quantity: 1 },
    ]);
  });
});

describe("addItem — errores", () => {
  it("propaga el error de leer el carrito sin llegar a consultar el producto", async () => {
    const supabase = mockSupabase({
      cart_items: { maybeSingle: dbError("permission denied for table cart_items", "42501") },
    });

    await expect(addItem(USER, PRODUCT, 1, supabase)).rejects.toThrow(
      "permission denied for table cart_items",
    );
    expect(supabase.calls("products")).toEqual([]);
  });

  it("propaga el error de leer el producto sin escribir nada", async () => {
    const supabase = mockSupabase({
      cart_items: { maybeSingle: null },
      products: { single: dbError("JSON object requested, multiple (or no) rows returned", "PGRST116") },
    });

    await expect(addItem(USER, PRODUCT, 1, supabase)).rejects.toThrow(
      "JSON object requested, multiple (or no) rows returned",
    );
    // El código de PostgREST viaja intacto: la UI distingue "no existe" de
    // "no tienes permiso" por él, no por el texto.
    await expect(addItem(USER, PRODUCT, 1, supabase)).rejects.toMatchObject({
      code: "PGRST116",
    });
    expect(supabase.inserts("cart_items")).toEqual([]);
  });

  it("propaga el error del insert", async () => {
    const supabase = mockSupabase({
      cart_items: { maybeSingle: null, insert: dbError("duplicate key value", "23505") },
      products: { single: { stock: 5 } },
    });

    await expect(addItem(USER, PRODUCT, 1, supabase)).rejects.toThrow("duplicate key value");
  });

  it("propaga el error del update del duplicado", async () => {
    const supabase = mockSupabase({
      cart_items: { maybeSingle: { id: "c1", quantity: 1 }, update: dbError("new row violates row-level security policy", "42501") },
      products: { single: { stock: 5 } },
    });

    await expect(addItem(USER, PRODUCT, 1, supabase)).rejects.toThrow(
      "new row violates row-level security policy",
    );
  });
});

describe("getItems", () => {
  const filaConProducto = {
    id: "c1",
    product_id: PRODUCT,
    quantity: 2,
    products: {
      id: PRODUCT,
      title: "Laptop Lenovo",
      // numeric(12,2) llega como string desde PostgREST.
      price: "2199.00",
      stock: 4,
      is_active: true,
      condition: "nuevo",
      product_images: [
        { image_path: "s1/p1/2.jpg", position: 2 },
        { image_path: "s1/p1/0.jpg", position: 0 },
      ],
    },
  };

  it("convierte price a number y resuelve la portada por menor position", async () => {
    const supabase = mockSupabase({ cart_items: { select: [filaConProducto] } });

    const items = await getItems(USER, supabase);

    expect(items).toHaveLength(1);
    expect(items[0].product?.price).toBe(2199);
    expect(typeof items[0].product?.price).toBe("number");
    expect(items[0].product?.image_url).toContain("product-images/s1/p1/0.jpg");
  });

  it("deja image_url en null cuando el producto no tiene imágenes", async () => {
    const supabase = mockSupabase({
      cart_items: {
        select: [{ ...filaConProducto, products: { ...filaConProducto.products, product_images: null } }],
      },
    });

    const items = await getItems(USER, supabase);

    expect(items[0].product?.image_url).toBeNull();
  });

  it("un producto desactivado llega como null y el ítem se conserva", async () => {
    // RLS oculta el producto y PostgREST devuelve null en el embed: la UI lo
    // pinta como "ya no disponible" en vez de perder la línea del carrito.
    const supabase = mockSupabase({
      cart_items: { select: [{ id: "c9", product_id: "px", quantity: 1, products: null }] },
    });

    const items = await getItems(USER, supabase);

    expect(items).toEqual([{ id: "c9", product_id: "px", quantity: 1, product: null }]);
  });

  it("pide el carrito del usuario en orden de llegada", async () => {
    const supabase = mockSupabase({ cart_items: { select: [] } });

    await getItems(USER, supabase);

    const [call] = supabase.calls("cart_items");
    expect(hasFilter(call.filters, "eq", "user_id", USER)).toBe(true);
    expect(call.orders).toEqual([{ column: "created_at", ascending: true }]);
  });

  it("devuelve lista vacía cuando no hay filas", async () => {
    const supabase = mockSupabase();

    await expect(getItems(USER, supabase)).resolves.toEqual([]);
  });

  it("propaga el error de lectura", async () => {
    const supabase = mockSupabase({ cart_items: { select: dbError("connection refused") } });

    await expect(getItems(USER, supabase)).rejects.toThrow("connection refused");
  });
});

describe("updateQuantity", () => {
  it("escribe la cantidad pedida sobre el id del ítem", async () => {
    const supabase = mockSupabase();

    await updateQuantity("c1", 7, supabase);

    expect(supabase.updates("cart_items")).toEqual([{ quantity: 7 }]);
    expect(hasFilter(supabase.filters("cart_items"), "eq", "id", "c1")).toBe(true);
  });

  it.each([[0], [-3]])("nunca baja de 1 (entrada %i)", async (quantity) => {
    const supabase = mockSupabase();

    await updateQuantity("c1", quantity, supabase);

    // Bajar a 0 no elimina la fila: para eso está removeItem.
    expect(supabase.updates("cart_items")).toEqual([{ quantity: 1 }]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ cart_items: { update: dbError("row-level security") } });

    await expect(updateQuantity("c1", 2, supabase)).rejects.toThrow("row-level security");
  });
});

describe("removeItem y clear", () => {
  it("removeItem borra por id de ítem", async () => {
    const supabase = mockSupabase();

    await removeItem("c1", supabase);

    expect(supabase.deletes("cart_items")).toBe(1);
    expect(hasFilter(supabase.filters("cart_items"), "eq", "id", "c1")).toBe(true);
  });

  it("clear borra por usuario, no por ítem", async () => {
    const supabase = mockSupabase();

    await clear(USER, supabase);

    expect(supabase.deletes("cart_items")).toBe(1);
    expect(hasFilter(supabase.filters("cart_items"), "eq", "user_id", USER)).toBe(true);
  });

  it("propagan sus errores", async () => {
    const supabase = mockSupabase({ cart_items: { delete: dbError("no autorizado") } });

    await expect(removeItem("c1", supabase)).rejects.toThrow("no autorizado");
    await expect(clear(USER, supabase)).rejects.toThrow("no autorizado");
  });
});
