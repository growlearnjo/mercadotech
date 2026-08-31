// Tests de services/chat.service.ts (Fase 6.3).
//
// MOCKEO DE DOS NIVELES (decisión 7): Supabase se INYECTA; `lib/ai/embeddings`
// y `lib/ai/completion` se mockean por módulo — este service los importa
// directo por diseño de la sesión 4. `context-builder`, `prompts`,
// `vector-search.service` y `product.service` NO se mockean: son la
// orquestación real que este archivo debe probar.
//
// ANCLA IMPORTANTE: cuando ninguna ficha supera el umbral,
// `hasRelevantContext` queda en false pero la completion SE LLAMA IGUAL, con
// el contexto vacío. Las instrucciones del modo ya cubren qué responder en
// ese caso. No hay atajo que evite el viaje al LLM.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/embeddings", () => ({
  generateEmbedding: vi.fn(),
  toPgVectorLiteral: vi.fn((embedding: number[]) => `[${embedding.join(",")}]`),
}));

vi.mock("@/lib/ai/completion", () => ({
  generateCompletion: vi.fn(),
}));

import { generateCompletion } from "@/lib/ai/completion";
import { generateEmbedding } from "@/lib/ai/embeddings";
import {
  SHOPPING_SYSTEM_INSTRUCTIONS,
  SUPPORT_SYSTEM_INSTRUCTIONS,
} from "@/lib/ai/prompts";
import { CONTEXT_BUILDER_MIN_CONTENT_LENGTH } from "@/lib/constants/ai";
import { ask } from "@/services/chat.service";
import { dbError, mockSupabase } from "@/services/test-utils/supabase-mock";

const VECTOR = [0.1, 0.2];
/** Contenido lo bastante largo para pasar el filtro de longitud del builder. */
const CONTENIDO = "a".repeat(CONTEXT_BUILDER_MIN_CONTENT_LENGTH + 10);

beforeEach(() => {
  vi.mocked(generateEmbedding).mockReset();
  vi.mocked(generateEmbedding).mockResolvedValue({ embedding: VECTOR, model: "mini-lm" });
  vi.mocked(generateCompletion).mockReset();
  vi.mocked(generateCompletion).mockResolvedValue({
    text: "Te recomiendo el [1].",
    model: "llama-3.1-8b",
    stopReason: "stop",
  });
});

function match(over: Record<string, unknown> = {}) {
  return {
    source_type: "producto",
    source_id: "p1",
    content: CONTENIDO,
    metadata: { title: "Laptop Lenovo IdeaPad 3" },
    // Por encima del umbral calibrado (0.38).
    similarity: 0.62,
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
    price: "1499.00",
    stock: 3,
    is_active: true,
    created_at: "2026-08-01T00:00:00Z",
    categories: { slug: "laptops" },
    product_images: [{ image_path: "s1/p1/0.jpg", position: 0 }],
    reviews: null,
  };
}

describe("ask — orden de la orquestación", () => {
  it("hace búsqueda → contexto → completion, en ese orden", async () => {
    const orden: string[] = [];
    vi.mocked(generateEmbedding).mockImplementation(async () => {
      orden.push("embedding");
      return { embedding: VECTOR, model: "mini-lm" };
    });
    vi.mocked(generateCompletion).mockImplementation(async () => {
      orden.push("completion");
      return { text: "ok", model: "llama", stopReason: null };
    });

    const supabase = mockSupabase({
      rpc: { match_knowledge: [match()] },
      products: { select: [filaProducto("p1")] },
    });

    await ask("audífonos", "compras", {}, supabase);

    // El RPC ocurre entre ambos: el embedding es su entrada y la completion
    // recibe el contexto que salió de él.
    expect(orden).toEqual(["embedding", "completion"]);
    expect(supabase.rpcCalls()).toHaveLength(1);
  });

  it("el userMessage que recibe el LLM sale del context-builder, con las fuentes numeradas", async () => {
    const supabase = mockSupabase({
      rpc: { match_knowledge: [match()] },
      products: { select: [filaProducto("p1")] },
    });

    await ask("audífonos para el gimnasio", "compras", {}, supabase);

    const [systemPrompt, userMessage] = vi.mocked(generateCompletion).mock.calls[0];
    expect(systemPrompt).toBe(SHOPPING_SYSTEM_INSTRUCTIONS);
    expect(userMessage).toContain("[Fuente 1]");
    expect(userMessage).toContain("Consulta del usuario: audífonos para el gimnasio");
  });
});

describe("ask — el modo elige fuente e instrucciones", () => {
  it("'compras' busca solo en el catálogo", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [] } });

    await ask("x", "compras", {}, supabase);

    expect(supabase.rpcCalls()[0].params).toMatchObject({ p_source_type: "producto" });
    expect(vi.mocked(generateCompletion).mock.calls[0][0]).toBe(SHOPPING_SYSTEM_INSTRUCTIONS);
  });

  it("'soporte' busca solo en la FAQ", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [] } });

    await ask("x", "soporte", {}, supabase);

    // Nunca se mezclan: un producto no responde una duda de devoluciones.
    expect(supabase.rpcCalls()[0].params).toMatchObject({ p_source_type: "articulo_soporte" });
    expect(vi.mocked(generateCompletion).mock.calls[0][0]).toBe(SUPPORT_SYSTEM_INSTRUCTIONS);
  });

  it("pasa topK y threshold del caller al RPC", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [] } });

    await ask("x", "compras", { topK: 2, similarityThreshold: 0.7 }, supabase);

    expect(supabase.rpcCalls()[0].params).toMatchObject({
      match_count: 2,
      similarity_threshold: 0.7,
    });
  });
});

describe("ask — sin contexto relevante", () => {
  it("hasRelevantContext = false pero la completion SE LLAMA igual", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [] } });

    const result = await ask("¿venden autos usados?", "compras", {}, supabase);

    expect(result.hasRelevantContext).toBe(false);
    expect(generateCompletion).toHaveBeenCalledTimes(1);
    // Con el aviso de "sin fuentes", no con un contexto inventado.
    expect(vi.mocked(generateCompletion).mock.calls[0][1]).toContain(
      "No se encontraron fuentes suficientemente relevantes",
    );
  });

  it("fichas bajo el umbral del builder cuentan como recuperadas pero no como usadas", async () => {
    const supabase = mockSupabase({
      // El RPC las devolvió (su threshold puede ser más laxo), pero el
      // context-builder aplica el suyo y las descarta.
      rpc: { match_knowledge: [match({ similarity: 0.1 })] },
    });

    const result = await ask("x", "compras", { similarityThreshold: 0.05 }, supabase);

    expect(result.hasRelevantContext).toBe(false);
    expect(result.metadata.retrievedCount).toBe(1);
    expect(result.metadata.usedSourceCount).toBe(0);
    expect(result.sources).toEqual([]);
  });

  it("una ficha demasiado corta también queda fuera del contexto", async () => {
    const supabase = mockSupabase({
      rpc: { match_knowledge: [match({ content: "corta" })] },
    });

    const result = await ask("x", "compras", {}, supabase);

    expect(result.metadata.retrievedCount).toBe(1);
    expect(result.metadata.usedSourceCount).toBe(0);
  });
});

describe("ask — resultado", () => {
  it("devuelve la respuesta del modelo y su metadata", async () => {
    const supabase = mockSupabase({
      rpc: { match_knowledge: [match()] },
      products: { select: [filaProducto("p1")] },
    });

    const result = await ask("audífonos", "compras", {}, supabase);

    expect(result).toMatchObject({
      query: "audífonos",
      answer: "Te recomiendo el [1].",
      hasRelevantContext: true,
      metadata: {
        model: "llama-3.1-8b",
        retrievedCount: 1,
        usedSourceCount: 1,
        contextTruncated: false,
      },
    });
  });

  it("enriquece las fuentes de producto con precio e imagen ACTUALES", async () => {
    const supabase = mockSupabase({
      rpc: { match_knowledge: [match()] },
      products: { select: [filaProducto("p1")] },
    });

    const result = await ask("audífonos", "compras", {}, supabase);

    expect(result.sources[0]).toMatchObject({
      position: 1,
      sourceType: "producto",
      sourceId: "p1",
      title: "Laptop Lenovo IdeaPad 3",
      price: 1499,
    });
    expect(result.sources[0].imageUrl).toContain("product-images/s1/p1/0.jpg");
  });

  it("una fuente de producto huérfana queda sin precio ni imagen, pero se cita igual", async () => {
    const supabase = mockSupabase({
      rpc: { match_knowledge: [match({ source_id: "borrado" })] },
      products: { select: [] },
    });

    const result = await ask("x", "compras", {}, supabase);

    expect(result.sources[0]).toMatchObject({ sourceId: "borrado", price: undefined });
    expect(result.sources[0].imageUrl).toBeUndefined();
  });

  it("en modo soporte no consulta la tabla de productos", async () => {
    const supabase = mockSupabase({
      rpc: {
        match_knowledge: [
          match({ source_type: "articulo_soporte", source_id: "a1", metadata: { title: "Devoluciones" } }),
        ],
      },
    });

    const result = await ask("¿cómo devuelvo?", "soporte", {}, supabase);

    expect(supabase.calls("products")).toEqual([]);
    expect(result.sources[0]).toMatchObject({
      sourceType: "articulo_soporte",
      title: "Devoluciones",
    });
  });
});

describe("ask — errores", () => {
  it("propaga el error del embedding sin llamar al RPC ni al LLM", async () => {
    vi.mocked(generateEmbedding).mockRejectedValue(new Error("no provider available"));
    const supabase = mockSupabase();

    await expect(ask("x", "compras", {}, supabase)).rejects.toThrow("no provider available");
    expect(supabase.rpcCalls()).toEqual([]);
    expect(generateCompletion).not.toHaveBeenCalled();
  });

  it("propaga el error del RPC sin llamar al LLM", async () => {
    const supabase = mockSupabase({
      rpc: { match_knowledge: dbError("permission denied for table knowledge_embeddings", "42501") },
    });

    await expect(ask("x", "compras", {}, supabase)).rejects.toThrow(
      "permission denied for table knowledge_embeddings",
    );
    expect(generateCompletion).not.toHaveBeenCalled();
  });

  it("propaga el error del LLM", async () => {
    vi.mocked(generateCompletion).mockRejectedValue(
      new Error("El modelo configurado ya no tiene proveedor de inferencia."),
    );
    const supabase = mockSupabase({ rpc: { match_knowledge: [] } });

    await expect(ask("x", "compras", {}, supabase)).rejects.toThrow(
      "El modelo configurado ya no tiene proveedor de inferencia.",
    );
  });
});
