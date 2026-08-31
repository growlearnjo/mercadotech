// Tests de services/favorite.service.ts (Fase 6.3). Cliente inyectado.
//
// El estado de "favorito" es la EXISTENCIA de la fila, no una columna: por eso
// `toggle` lee y luego inserta o borra, en dos pasos, y por eso el test afirma
// cuál de los dos caminos se tomó.

import { describe, expect, it } from "vitest";

import { isFavorite, listMine, toggle } from "@/services/favorite.service";
import { dbError, hasFilter, mockSupabase } from "@/services/test-utils/supabase-mock";

const PRODUCT = "p1";
const USER = "u1";

describe("isFavorite", () => {
  it("true cuando existe la fila", async () => {
    const supabase = mockSupabase({ favorites: { maybeSingle: { id: "f1" } } });

    await expect(isFavorite(PRODUCT, USER, supabase)).resolves.toBe(true);
  });

  it("false cuando no existe", async () => {
    const supabase = mockSupabase({ favorites: { maybeSingle: null } });

    await expect(isFavorite(PRODUCT, USER, supabase)).resolves.toBe(false);
  });

  it("busca por producto Y usuario", async () => {
    const supabase = mockSupabase({ favorites: { maybeSingle: null } });

    await isFavorite(PRODUCT, USER, supabase);

    const filtros = supabase.filters("favorites");
    expect(hasFilter(filtros, "eq", "product_id", PRODUCT)).toBe(true);
    expect(hasFilter(filtros, "eq", "user_id", USER)).toBe(true);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ favorites: { maybeSingle: dbError("boom") } });

    await expect(isFavorite(PRODUCT, USER, supabase)).rejects.toThrow("boom");
  });
});

describe("toggle", () => {
  it("si no era favorito, inserta y devuelve true", async () => {
    const supabase = mockSupabase({ favorites: { maybeSingle: null } });

    await expect(toggle(PRODUCT, USER, supabase)).resolves.toBe(true);
    expect(supabase.inserts("favorites")).toEqual([
      { product_id: PRODUCT, user_id: USER },
    ]);
    expect(supabase.deletes("favorites")).toBe(0);
  });

  it("si ya era favorito, borra y devuelve false", async () => {
    const supabase = mockSupabase({ favorites: { maybeSingle: { id: "f1" } } });

    await expect(toggle(PRODUCT, USER, supabase)).resolves.toBe(false);
    expect(supabase.deletes("favorites")).toBe(1);
    expect(supabase.inserts("favorites")).toEqual([]);
  });

  it("el borrado apunta a la fila de ese usuario y ese producto", async () => {
    const supabase = mockSupabase({ favorites: { maybeSingle: { id: "f1" } } });

    await toggle(PRODUCT, USER, supabase);

    const borrado = supabase.calls("favorites")[1];
    expect(hasFilter(borrado.filters, "eq", "product_id", PRODUCT)).toBe(true);
    expect(hasFilter(borrado.filters, "eq", "user_id", USER)).toBe(true);
  });

  it("propaga el error del insert", async () => {
    const supabase = mockSupabase({
      favorites: { maybeSingle: null, insert: dbError("duplicate key value", "23505") },
    });

    await expect(toggle(PRODUCT, USER, supabase)).rejects.toThrow("duplicate key value");
  });

  it("propaga el error del delete", async () => {
    const supabase = mockSupabase({
      favorites: { maybeSingle: { id: "f1" }, delete: dbError("permission denied", "42501") },
    });

    await expect(toggle(PRODUCT, USER, supabase)).rejects.toThrow("permission denied");
  });
});

describe("listMine", () => {
  const favorito = (over: Record<string, unknown> = {}) => ({
    created_at: "2026-08-30T00:00:00Z",
    products: {
      id: PRODUCT,
      seller_id: "s1",
      category_id: "c1",
      title: "Laptop Lenovo",
      description: null,
      brand: "Lenovo",
      condition: "nuevo",
      price: "2199.00",
      stock: 3,
      is_active: true,
      created_at: "2026-08-01T00:00:00Z",
      product_images: [{ image_path: "s1/p1/0.jpg", position: 0 }],
      reviews: [{ rating: 5 }, { rating: 3 }],
      ...over,
    },
  });

  it("devuelve cards completas: price number, portada y agregados", async () => {
    const supabase = mockSupabase({ favorites: { select: [favorito()] } });

    const [product] = await listMine(USER, supabase);

    expect(product.price).toBe(2199);
    expect(product.image_url).toContain("product-images/s1/p1/0.jpg");
    expect(product.average_rating).toBe(4);
    expect(product.review_count).toBe(2);
  });

  it("omite el favorito cuyo producto fue desactivado (llega como null por RLS)", async () => {
    const supabase = mockSupabase({
      favorites: { select: [{ created_at: "2026-08-30T00:00:00Z", products: null }, favorito()] },
    });

    // Pintar una card vacía sería peor que no pintarla.
    await expect(listMine(USER, supabase)).resolves.toHaveLength(1);
  });

  it("sin imágenes ni reseñas deja null en ambos agregados", async () => {
    const supabase = mockSupabase({
      favorites: { select: [favorito({ product_images: null, reviews: null })] },
    });

    const [product] = await listMine(USER, supabase);

    expect(product.image_url).toBeNull();
    expect(product.average_rating).toBeNull();
    expect(product.review_count).toBe(0);
  });

  it("filtra por usuario y ordena por fecha de marcado descendente", async () => {
    const supabase = mockSupabase({ favorites: { select: [] } });

    await listMine(USER, supabase);

    const [call] = supabase.calls("favorites");
    expect(hasFilter(call.filters, "eq", "user_id", USER)).toBe(true);
    expect(call.orders).toEqual([{ column: "created_at", ascending: false }]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ favorites: { select: dbError("boom") } });

    await expect(listMine(USER, supabase)).rejects.toThrow("boom");
  });
});
