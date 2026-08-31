// Tests de services/product.service.ts (Fase 6.3). Cliente inyectado.
//
// Este service concentra la traducción "lo que devuelve PostgREST" → "lo que
// la card necesita": price a number, portada por menor position, agregados de
// reseñas. Y construye la query del catálogo filtro a filtro — eso también es
// contrato: si deja de mandar `is_active = true`, un vendedor vería sus
// productos despublicados mezclados en la home.

import { describe, expect, it } from "vitest";

import {
  getProductById,
  getProductImages,
  getProductsByIds,
  listActiveProducts,
  registerView,
} from "@/services/product.service";
import { PRODUCTS_PAGE_SIZE } from "@/lib/constants/catalog";
import { dbError, hasFilter, mockSupabase } from "@/services/test-utils/supabase-mock";

const filaProducto = {
  id: "p1",
  seller_id: "s1",
  category_id: "c1",
  title: "Laptop Lenovo IdeaPad 3",
  description: "14 pulgadas",
  brand: "Lenovo",
  condition: "nuevo",
  price: "2199.00",
  stock: 4,
  is_active: true,
  created_at: "2026-08-01T00:00:00Z",
  categories: { slug: "laptops" },
  product_images: [
    { image_path: "s1/p1/1.jpg", position: 1 },
    { image_path: "s1/p1/0.jpg", position: 0 },
  ],
  reviews: [{ rating: 5 }, { rating: 4 }],
};

describe("listActiveProducts — construcción de la query", () => {
  it("siempre filtra is_active = true, aunque RLS ya lo imponga a los anónimos", async () => {
    const supabase = mockSupabase({ products: { select: [] } });

    await listActiveProducts({}, supabase);

    expect(hasFilter(supabase.filters("products"), "eq", "is_active", true)).toBe(true);
  });

  it("pide el count exacto para poder paginar", async () => {
    const supabase = mockSupabase({ products: { select: [], count: 27 } });

    const { total } = await listActiveProducts({}, supabase);

    expect(total).toBe(27);
  });

  it("devuelve total 0 cuando PostgREST no manda count", async () => {
    const supabase = mockSupabase({ products: { select: [] } });

    await expect(listActiveProducts({}, supabase)).resolves.toMatchObject({ total: 0 });
  });

  it("la página 1 pide el rango [0, PAGE_SIZE-1]", async () => {
    const supabase = mockSupabase({ products: { select: [] } });

    await listActiveProducts({}, supabase);

    expect(supabase.calls("products")[0].range).toEqual({
      from: 0,
      to: PRODUCTS_PAGE_SIZE - 1,
    });
  });

  it("la página 3 desplaza el rango en dos páginas completas", async () => {
    const supabase = mockSupabase({ products: { select: [] } });

    await listActiveProducts({ page: 3 }, supabase);

    expect(supabase.calls("products")[0].range).toEqual({
      from: PRODUCTS_PAGE_SIZE * 2,
      to: PRODUCTS_PAGE_SIZE * 3 - 1,
    });
  });

  it.each([[0], [-4]])("una página inválida (%i) se trata como la 1", async (page) => {
    const supabase = mockSupabase({ products: { select: [] } });

    await listActiveProducts({ page }, supabase);

    expect(supabase.calls("products")[0].range).toEqual({
      from: 0,
      to: PRODUCTS_PAGE_SIZE - 1,
    });
  });

  it("filtra por slug de categoría en la misma consulta, vía el inner join", async () => {
    const supabase = mockSupabase({ products: { select: [] } });

    await listActiveProducts({ categorySlug: "laptops" }, supabase);

    expect(hasFilter(supabase.filters("products"), "eq", "categories.slug", "laptops")).toBe(true);
  });

  it("la búsqueda de texto va contra título y marca a la vez", async () => {
    const supabase = mockSupabase({ products: { select: [] } });

    await listActiveProducts({ search: "lenovo" }, supabase);

    const [or] = supabase.filters("products").filter((f) => f.method === "or");
    expect(or.value).toBe("title.ilike.%lenovo%,brand.ilike.%lenovo%");
  });

  it("limpia % y comas de la búsqueda: son sintaxis del filtro, no texto", async () => {
    const supabase = mockSupabase({ products: { select: [] } });

    await listActiveProducts({ search: "  100%,lenovo  " }, supabase);

    const [or] = supabase.filters("products").filter((f) => f.method === "or");
    expect(or.value).toBe("title.ilike.%100lenovo%,brand.ilike.%100lenovo%");
  });

  it("una búsqueda de solo espacios no agrega filtro de texto", async () => {
    const supabase = mockSupabase({ products: { select: [] } });

    await listActiveProducts({ search: "   " }, supabase);

    expect(supabase.filters("products").some((f) => f.method === "or")).toBe(false);
  });

  it("la condición viaja como IN con la lista completa", async () => {
    const supabase = mockSupabase({ products: { select: [] } });

    await listActiveProducts({ condition: ["nuevo", "usado"] }, supabase);

    expect(hasFilter(supabase.filters("products"), "in", "condition", ["nuevo", "usado"])).toBe(true);
  });

  it("una lista de condiciones vacía no agrega filtro", async () => {
    const supabase = mockSupabase({ products: { select: [] } });

    await listActiveProducts({ condition: [] }, supabase);

    expect(supabase.filters("products").some((f) => f.method === "in")).toBe(false);
  });

  it("el rango de precio usa gte y lte, y 0 cuenta como valor", async () => {
    const supabase = mockSupabase({ products: { select: [] } });

    await listActiveProducts({ minPrice: 0, maxPrice: 1500 }, supabase);

    const filtros = supabase.filters("products");
    // `typeof === "number"` y no truthiness: con `if (filters.minPrice)` un
    // mínimo de 0 se perdería.
    expect(hasFilter(filtros, "gte", "price", 0)).toBe(true);
    expect(hasFilter(filtros, "lte", "price", 1500)).toBe(true);
  });

  it.each([
    ["recientes", { column: "created_at", ascending: false }],
    ["precio_asc", { column: "price", ascending: true }],
    ["precio_desc", { column: "price", ascending: false }],
  ] as const)("el orden %s se traduce a su columna", async (sort, esperado) => {
    const supabase = mockSupabase({ products: { select: [] } });

    await listActiveProducts({ sort }, supabase);

    expect(supabase.calls("products")[0].orders[0]).toEqual(esperado);
  });

  it("sin orden explícito usa el default (recientes)", async () => {
    const supabase = mockSupabase({ products: { select: [] } });

    await listActiveProducts({}, supabase);

    expect(supabase.calls("products")[0].orders[0]).toEqual({
      column: "created_at",
      ascending: false,
    });
  });

  it("siempre agrega el desempate estable por id", async () => {
    const supabase = mockSupabase({ products: { select: [] } });

    await listActiveProducts({ sort: "precio_asc" }, supabase);

    // Sin esto, dos productos al mismo precio pueden cambiar de orden entre
    // páginas y aparecer duplicados o desaparecer.
    expect(supabase.calls("products")[0].orders).toEqual([
      { column: "price", ascending: true },
      { column: "id", ascending: true },
    ]);
  });

  it("propaga el error de la consulta", async () => {
    const supabase = mockSupabase({ products: { select: dbError("statement timeout", "57014") } });

    await expect(listActiveProducts({}, supabase)).rejects.toThrow("statement timeout");
  });
});

describe("listActiveProducts — mapeo de la fila", () => {
  it("price string → number, portada por menor position y agregados de reseñas", async () => {
    const supabase = mockSupabase({ products: { select: [filaProducto] } });

    const { items } = await listActiveProducts({}, supabase);

    expect(items[0].price).toBe(2199);
    expect(items[0].image_url).toContain("product-images/s1/p1/0.jpg");
    expect(items[0].average_rating).toBe(4.5);
    expect(items[0].review_count).toBe(2);
  });

  it("sin reseñas el promedio es null y el conteo 0, no 0 y 0", async () => {
    const supabase = mockSupabase({
      products: { select: [{ ...filaProducto, reviews: [] }] },
    });

    const { items } = await listActiveProducts({}, supabase);

    // null y 0 significan cosas distintas: "sin datos" vs "media cero".
    expect(items[0].average_rating).toBeNull();
    expect(items[0].review_count).toBe(0);
  });

  it("sin imágenes deja image_url en null", async () => {
    const supabase = mockSupabase({
      products: { select: [{ ...filaProducto, product_images: null }] },
    });

    const { items } = await listActiveProducts({}, supabase);

    expect(items[0].image_url).toBeNull();
  });

  it("una condición desconocida en la BD degrada a 'usado' en vez de romper", async () => {
    const supabase = mockSupabase({
      products: { select: [{ ...filaProducto, condition: "restaurado" }] },
    });

    const { items } = await listActiveProducts({}, supabase);

    expect(items[0].condition).toBe("usado");
  });

  it("no filtra las relaciones al tipo de dominio", async () => {
    const supabase = mockSupabase({ products: { select: [filaProducto] } });

    const { items } = await listActiveProducts({}, supabase);

    expect(items[0]).not.toHaveProperty("categories");
    expect(items[0]).not.toHaveProperty("product_images");
    expect(items[0]).not.toHaveProperty("reviews");
  });
});

describe("getProductById", () => {
  it("devuelve el producto mapeado", async () => {
    const supabase = mockSupabase({ products: { maybeSingle: filaProducto } });

    const product = await getProductById("p1", supabase);

    expect(product?.price).toBe(2199);
    expect(hasFilter(supabase.filters("products"), "eq", "id", "p1")).toBe(true);
  });

  it("devuelve null cuando no existe", async () => {
    await expect(getProductById("px", mockSupabase())).resolves.toBeNull();
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ products: { maybeSingle: dbError("boom") } });

    await expect(getProductById("p1", supabase)).rejects.toThrow("boom");
  });
});

describe("getProductsByIds", () => {
  it("con lista vacía no consulta nada", async () => {
    const supabase = mockSupabase();

    await expect(getProductsByIds([], supabase)).resolves.toEqual([]);
    expect(supabase.calls("products")).toEqual([]);
  });

  it("consulta por IN y exige que sigan activos", async () => {
    const supabase = mockSupabase({ products: { select: [filaProducto] } });

    const products = await getProductsByIds(["p1", "p2"], supabase);

    const filtros = supabase.filters("products");
    expect(hasFilter(filtros, "in", "id", ["p1", "p2"])).toBe(true);
    expect(hasFilter(filtros, "eq", "is_active", true)).toBe(true);
    // Pide 2 y devuelve 1: los ids sin producto activo simplemente faltan, y
    // es el caller quien decide qué hacer con ellos.
    expect(products).toHaveLength(1);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ products: { select: dbError("boom") } });

    await expect(getProductsByIds(["p1"], supabase)).rejects.toThrow("boom");
  });
});

describe("getProductImages", () => {
  it("devuelve la galería ordenada por position con su URL resuelta", async () => {
    const supabase = mockSupabase({
      product_images: {
        select: [
          { id: "i1", product_id: "p1", image_path: "s1/p1/0.jpg", position: 0 },
          { id: "i2", product_id: "p1", image_path: "s1/p1/1.jpg", position: 1 },
        ],
      },
    });

    const images = await getProductImages("p1", supabase);

    expect(images.map((i) => i.image_url)).toEqual([
      expect.stringContaining("product-images/s1/p1/0.jpg"),
      expect.stringContaining("product-images/s1/p1/1.jpg"),
    ]);
    expect(supabase.calls("product_images")[0].orders).toEqual([
      { column: "position", ascending: true },
    ]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ product_images: { select: dbError("boom") } });

    await expect(getProductImages("p1", supabase)).rejects.toThrow("boom");
  });
});

describe("registerView", () => {
  it("inserta la vista con producto y usuario", async () => {
    const supabase = mockSupabase();

    await registerView("p1", "u1", supabase);

    expect(supabase.inserts("product_views")).toEqual([
      { product_id: "p1", user_id: "u1" },
    ]);
  });

  it("propaga el error: es el caller quien decide ignorarlo", async () => {
    const supabase = mockSupabase({
      product_views: { insert: dbError("new row violates row-level security policy", "42501") },
    });

    await expect(registerView("p1", "u1", supabase)).rejects.toThrow(
      "new row violates row-level security policy",
    );
  });
});
