// Tests de services/vector-search.service.ts (Fase 6.3).
//
// MOCKEO DE DOS NIVELES (decisión 7): Supabase se INYECTA; `lib/ai/embeddings`
// se mockea por módulo, porque este service lo importa directo por diseño de
// la sesión 4. `product.service` NO se mockea: recibe el mismo cliente
// inyectado y se prueba de verdad como parte de la hidratación.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/embeddings", () => ({
  generateEmbedding: vi.fn(),
  toPgVectorLiteral: vi.fn((embedding: number[]) => `[${embedding.join(",")}]`),
}));

import { generateEmbedding } from "@/lib/ai/embeddings";
import { searchByEmbedding, searchProducts } from "@/services/vector-search.service";
import {
  VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD,
  VECTOR_SEARCH_DEFAULT_TOP_K,
  VECTOR_SEARCH_MAX_TOP_K,
} from "@/lib/constants/ai";
import { dbError, mockSupabase } from "@/services/test-utils/supabase-mock";

const VECTOR = [0.1, 0.2];

beforeEach(() => {
  vi.mocked(generateEmbedding).mockReset();
  vi.mocked(generateEmbedding).mockResolvedValue({ embedding: VECTOR, model: "mini-lm" });
});

function match(over: Record<string, unknown> = {}) {
  return {
    source_type: "producto",
    source_id: "p1",
    content: "Laptop Lenovo IdeaPad 3",
    metadata: { title: "Laptop Lenovo IdeaPad 3" },
    similarity: 0.51,
    ...over,
  };
}

function filaProducto(id: string) {
  return {
    id,
    seller_id: "s1",
    category_id: "c1",
    title: `Producto ${id}`,
    description: null,
    brand: null,
    condition: "nuevo",
    price: "999.00",
    stock: 2,
    is_active: true,
    created_at: "2026-08-01T00:00:00Z",
    categories: { slug: "laptops" },
    product_images: null,
    reviews: null,
  };
}

describe("searchByEmbedding", () => {
  it("pasa topK y threshold al RPC match_knowledge", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [] } });

    await searchByEmbedding(VECTOR, { topK: 3, similarityThreshold: 0.5 }, supabase);

    expect(supabase.rpcCalls()).toEqual([
      {
        name: "match_knowledge",
        params: {
          query_embedding: "[0.1,0.2]",
          p_source_type: undefined,
          match_count: 3,
          similarity_threshold: 0.5,
        },
      },
    ]);
  });

  it("sin opciones usa los defaults calibrados en la Fase 4.8", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [] } });

    await searchByEmbedding(VECTOR, {}, supabase);

    expect(supabase.rpcCalls()[0].params).toMatchObject({
      match_count: VECTOR_SEARCH_DEFAULT_TOP_K,
      similarity_threshold: VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD,
    });
  });

  it("recorta topK al tope duro aunque el caller pida más", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [] } });

    await searchByEmbedding(VECTOR, { topK: 500 }, supabase);

    expect(supabase.rpcCalls()[0].params).toMatchObject({
      match_count: VECTOR_SEARCH_MAX_TOP_K,
    });
  });

  it("un sourceType null busca en ambas fuentes (el default del RPC)", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [] } });

    await searchByEmbedding(VECTOR, { sourceType: null }, supabase);

    expect(supabase.rpcCalls()[0].params).toMatchObject({ p_source_type: undefined });
  });

  it("mapea las filas del RPC a la forma del dominio", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [match()] } });

    await expect(searchByEmbedding(VECTOR, {}, supabase)).resolves.toEqual([
      {
        sourceType: "producto",
        sourceId: "p1",
        content: "Laptop Lenovo IdeaPad 3",
        metadata: { title: "Laptop Lenovo IdeaPad 3" },
        similarity: 0.51,
      },
    ]);
  });

  it("una metadata nula se normaliza a objeto vacío", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [match({ metadata: null })] } });

    const [result] = await searchByEmbedding(VECTOR, {}, supabase);

    expect(result.metadata).toEqual({});
  });

  it("propaga el error del RPC", async () => {
    const supabase = mockSupabase({
      rpc: { match_knowledge: dbError("function match_knowledge does not exist", "42883") },
    });

    await expect(searchByEmbedding(VECTOR, {}, supabase)).rejects.toThrow(
      "function match_knowledge does not exist",
    );
  });
});

describe("searchProducts", () => {
  it("genera el embedding de la consulta y restringe la búsqueda a productos", async () => {
    const supabase = mockSupabase({
      rpc: { match_knowledge: [match()] },
      products: { select: [filaProducto("p1")] },
    });

    await searchProducts("audífonos", { topK: 4 }, supabase);

    expect(generateEmbedding).toHaveBeenCalledWith("audífonos");
    expect(supabase.rpcCalls()[0].params).toMatchObject({
      p_source_type: "producto",
      match_count: 4,
    });
  });

  it("hidrata contra los datos ACTUALES del producto, no contra la copia de la ficha", async () => {
    const supabase = mockSupabase({
      rpc: { match_knowledge: [match()] },
      products: { select: [filaProducto("p1")] },
    });

    const results = await searchProducts("audífonos", {}, supabase);

    expect(results).toHaveLength(1);
    // La ficha guardó el texto en el momento de indexar; el precio sale de
    // `products`, ya convertido a number.
    expect(results[0].product.price).toBe(999);
    expect(results[0].similarity).toBe(0.51);
  });

  it("DESCARTA los resultados huérfanos: la ficha existe pero el producto ya no", async () => {
    const supabase = mockSupabase({
      rpc: {
        match_knowledge: [
          match({ source_id: "vivo", similarity: 0.9 }),
          match({ source_id: "huerfano", similarity: 0.8 }),
        ],
      },
      // La consulta de hidratación solo devuelve el que sigue activo.
      products: { select: [filaProducto("vivo")] },
    });

    const results = await searchProducts("audífonos", {}, supabase);

    expect(results.map((r) => r.product.id)).toEqual(["vivo"]);
  });

  it("conserva el orden de similitud que devolvió el RPC", async () => {
    const supabase = mockSupabase({
      rpc: {
        match_knowledge: [
          match({ source_id: "a", similarity: 0.9 }),
          match({ source_id: "b", similarity: 0.7 }),
        ],
      },
      // PostgREST devuelve los productos en cualquier orden: el service
      // recorre los MATCHES, no los productos.
      products: { select: [filaProducto("b"), filaProducto("a")] },
    });

    const results = await searchProducts("x", {}, supabase);

    expect(results.map((r) => r.product.id)).toEqual(["a", "b"]);
  });

  it("sin coincidencias corta antes de consultar productos", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [] } });

    await expect(searchProducts("nada", {}, supabase)).resolves.toEqual([]);
    expect(supabase.calls("products")).toEqual([]);
  });

  it("propaga el error del proveedor de embeddings sin llamar al RPC", async () => {
    vi.mocked(generateEmbedding).mockRejectedValue(new Error("no provider available"));
    const supabase = mockSupabase();

    await expect(searchProducts("x", {}, supabase)).rejects.toThrow("no provider available");
    expect(supabase.rpcCalls()).toEqual([]);
  });
});
