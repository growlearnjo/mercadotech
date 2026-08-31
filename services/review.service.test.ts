// Tests de services/review.service.ts (Fase 6.3). Cliente inyectado.
//
// "Reseña verificada" no es una etiqueta: `canReview` exige un pedido
// ENTREGADO del comprador que contenga el producto, y que no haya reseñado
// antes. La RLS lo garantiza igual; esto evita ofrecer un formulario que va a
// fallar. Los dos motivos de rechazo son distintos y la UI los distingue.

import { describe, expect, it } from "vitest";

import { canReview, create, getAverage, listByProduct } from "@/services/review.service";
import { dbError, hasFilter, mockSupabase } from "@/services/test-utils/supabase-mock";

const PRODUCT = "p1";
const USER = "buyer-1";

describe("listByProduct", () => {
  it("etiqueta al autor sin exponer su nombre real", async () => {
    const supabase = mockSupabase({
      reviews: { select: [{ id: "r1", product_id: PRODUCT, rating: 5, comment: "Excelente" }] },
    });

    const [review] = await listByProduct(PRODUCT, supabase);

    // `profiles` solo es legible por su dueño: mostrar nombres exigiría una
    // vista pública nueva (decisión 8 de la sesión 3).
    expect(review.author_label).toBe("Comprador verificado");
  });

  it("filtra por producto y ordena de la más reciente a la más antigua", async () => {
    const supabase = mockSupabase({ reviews: { select: [] } });

    await listByProduct(PRODUCT, supabase);

    const [call] = supabase.calls("reviews");
    expect(hasFilter(call.filters, "eq", "product_id", PRODUCT)).toBe(true);
    expect(call.orders).toEqual([{ column: "created_at", ascending: false }]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ reviews: { select: dbError("boom") } });

    await expect(listByProduct(PRODUCT, supabase)).rejects.toThrow("boom");
  });
});

describe("getAverage", () => {
  it("promedia las calificaciones y cuenta cuántas hay", async () => {
    const supabase = mockSupabase({
      reviews: { select: [{ rating: 5 }, { rating: 4 }, { rating: 3 }] },
    });

    await expect(getAverage(PRODUCT, supabase)).resolves.toEqual({ average: 4, count: 3 });
  });

  it("sin reseñas devuelve average null, no 0", async () => {
    // 0 se pintaría como "cero estrellas"; null se pinta como "sin reseñas".
    await expect(getAverage(PRODUCT, mockSupabase())).resolves.toEqual({
      average: null,
      count: 0,
    });
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ reviews: { select: dbError("boom") } });

    await expect(getAverage(PRODUCT, supabase)).rejects.toThrow("boom");
  });
});

describe("canReview", () => {
  it("false con motivo 'ya_resenado' si ya dejó una, sin mirar los pedidos", async () => {
    const supabase = mockSupabase({ reviews: { maybeSingle: { id: "r1" } } });

    await expect(canReview(PRODUCT, USER, supabase)).resolves.toEqual({
      allowed: false,
      orderId: null,
      reason: "ya_resenado",
    });
    // Corta antes: no gasta una segunda consulta.
    expect(supabase.calls("order_items")).toEqual([]);
  });

  it("false con motivo 'sin_compra' si no hay pedido entregado con el producto", async () => {
    const supabase = mockSupabase({
      reviews: { maybeSingle: null },
      order_items: { select: [] },
    });

    await expect(canReview(PRODUCT, USER, supabase)).resolves.toEqual({
      allowed: false,
      orderId: null,
      reason: "sin_compra",
    });
  });

  it("true con el orderId que habilita la reseña", async () => {
    const supabase = mockSupabase({
      reviews: { maybeSingle: null },
      order_items: { select: [{ order_id: "o-entregado" }] },
    });

    await expect(canReview(PRODUCT, USER, supabase)).resolves.toEqual({
      allowed: true,
      orderId: "o-entregado",
      reason: null,
    });
  });

  it("exige que el pedido sea del comprador Y esté entregado", async () => {
    const supabase = mockSupabase({
      reviews: { maybeSingle: null },
      order_items: { select: [{ order_id: "o1" }] },
    });

    await canReview(PRODUCT, USER, supabase);

    const filtros = supabase.filters("order_items");
    expect(hasFilter(filtros, "eq", "product_id", PRODUCT)).toBe(true);
    expect(hasFilter(filtros, "eq", "orders.buyer_id", USER)).toBe(true);
    expect(hasFilter(filtros, "eq", "orders.status", "entregado")).toBe(true);
    expect(supabase.calls("order_items")[0].limit).toBe(1);
  });

  it("propaga el error de la consulta de reseña existente", async () => {
    const supabase = mockSupabase({ reviews: { maybeSingle: dbError("boom") } });

    await expect(canReview(PRODUCT, USER, supabase)).rejects.toThrow("boom");
  });

  it("propaga el error de la consulta de pedidos", async () => {
    const supabase = mockSupabase({
      reviews: { maybeSingle: null },
      order_items: { select: dbError("permission denied", "42501") },
    });

    await expect(canReview(PRODUCT, USER, supabase)).rejects.toThrow("permission denied");
  });
});

describe("create", () => {
  it("inserta la reseña con el pedido que la habilita y la devuelve etiquetada", async () => {
    const fila = {
      id: "r-nueva",
      product_id: PRODUCT,
      order_id: "o1",
      buyer_id: USER,
      rating: 5,
      comment: "Llegó rápido",
    };
    const supabase = mockSupabase({ reviews: { single: fila } });

    const review = await create(
      { productId: PRODUCT, orderId: "o1", buyerId: USER, rating: 5, comment: "Llegó rápido" },
      supabase,
    );

    expect(supabase.inserts("reviews")).toEqual([
      {
        product_id: PRODUCT,
        order_id: "o1",
        buyer_id: USER,
        rating: 5,
        comment: "Llegó rápido",
      },
    ]);
    expect(review.author_label).toBe("Comprador verificado");
  });

  it("acepta comentario nulo: la calificación sola es una reseña válida", async () => {
    const supabase = mockSupabase({ reviews: { single: { id: "r1", rating: 4, comment: null } } });

    await create(
      { productId: PRODUCT, orderId: "o1", buyerId: USER, rating: 4, comment: null },
      supabase,
    );

    expect(supabase.inserts("reviews")[0]).toMatchObject({ comment: null });
  });

  it("propaga el error del unique por comprador/producto", async () => {
    const supabase = mockSupabase({
      reviews: { single: dbError("duplicate key value violates unique constraint", "23505") },
    });

    await expect(
      create({ productId: PRODUCT, orderId: "o1", buyerId: USER, rating: 5, comment: null }, supabase),
    ).rejects.toThrow("duplicate key value violates unique constraint");
  });
});
