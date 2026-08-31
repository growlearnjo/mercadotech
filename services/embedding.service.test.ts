// Tests de services/embedding.service.ts (Fase 6.3).
//
// MOCKEO DE DOS NIVELES (decisión 7 de la spec):
//   · Supabase se INYECTA por el último parámetro, como en todo el resto.
//   · `lib/ai/embeddings` se mockea con `vi.mock` de MÓDULO. Es la ÚNICA
//     excepción permitida, y es por diseño de la sesión 4: este service
//     importa las funciones directo (el proveedor de IA es un secreto del
//     servidor, no un parámetro que la UI pueda pasar), así que no hay puerta
//     que abrir — hay que sustituir el módulo entero.
//
// Sin este mock, el test llamaría a Hugging Face de verdad: red, cuota y un
// test que falla los domingos.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/embeddings", () => ({
  generateEmbedding: vi.fn(),
  toPgVectorLiteral: vi.fn((embedding: number[]) => `[${embedding.join(",")}]`),
  buildProductEmbeddingText: vi.fn(() => "TEXTO-PRODUCTO"),
  buildSupportArticleEmbeddingText: vi.fn(() => "TEXTO-ARTICULO"),
}));

import {
  buildProductEmbeddingText,
  buildSupportArticleEmbeddingText,
  generateEmbedding,
} from "@/lib/ai/embeddings";
import { indexKnowledgeSource } from "@/services/embedding.service";
import { dbError, hasFilter, mockSupabase } from "@/services/test-utils/supabase-mock";

const VECTOR = [0.1, 0.2, 0.3];

beforeEach(() => {
  vi.mocked(generateEmbedding).mockReset();
  vi.mocked(generateEmbedding).mockResolvedValue({ embedding: VECTOR, model: "mini-lm" });
  vi.mocked(buildProductEmbeddingText).mockClear();
  vi.mocked(buildSupportArticleEmbeddingText).mockClear();
});

const productoActivo = {
  id: "p1",
  title: "Laptop Lenovo IdeaPad 3",
  brand: "Lenovo",
  condition: "nuevo",
  description: "14 pulgadas",
  is_active: true,
  categories: { name: "Laptops" },
};

const articuloPublicado = {
  id: "a1",
  title: "Política de devoluciones",
  category: "Devoluciones",
  content: "Tienes 7 días…",
  is_published: true,
};

describe("indexKnowledgeSource — producto", () => {
  it("arma el texto, genera la ficha y la upsertea con su metadata", async () => {
    const supabase = mockSupabase({ products: { maybeSingle: productoActivo } });

    await expect(indexKnowledgeSource("producto", "p1", supabase)).resolves.toEqual({
      indexed: true,
    });

    expect(buildProductEmbeddingText).toHaveBeenCalledWith({
      title: "Laptop Lenovo IdeaPad 3",
      brand: "Lenovo",
      categoryName: "Laptops",
      condition: "nuevo",
      description: "14 pulgadas",
    });
    expect(generateEmbedding).toHaveBeenCalledWith("TEXTO-PRODUCTO");
    expect(supabase.upserts("knowledge_embeddings")).toEqual([
      {
        source_type: "producto",
        source_id: "p1",
        chunk_index: 0,
        content: "TEXTO-PRODUCTO",
        embedding: "[0.1,0.2,0.3]",
        metadata: { title: "Laptop Lenovo IdeaPad 3" },
      },
    ]);
  });

  it("acepta la categoría venga como objeto o como array de PostgREST", async () => {
    const supabase = mockSupabase({
      products: { maybeSingle: { ...productoActivo, categories: [{ name: "Laptops" }] } },
    });

    await indexKnowledgeSource("producto", "p1", supabase);

    expect(buildProductEmbeddingText).toHaveBeenCalledWith(
      expect.objectContaining({ categoryName: "Laptops" }),
    );
  });

  it("sin categoría manda categoryName null en vez de romper", async () => {
    const supabase = mockSupabase({
      products: { maybeSingle: { ...productoActivo, categories: null } },
    });

    await indexKnowledgeSource("producto", "p1", supabase);

    expect(buildProductEmbeddingText).toHaveBeenCalledWith(
      expect.objectContaining({ categoryName: null }),
    );
  });

  it("si el producto ya no existe, BORRA la ficha huérfana en vez de dejarla stale", async () => {
    const supabase = mockSupabase({ products: { maybeSingle: null } });

    await expect(indexKnowledgeSource("producto", "p1", supabase)).resolves.toEqual({
      indexed: false,
      reason: "fuente_no_existe",
    });

    expect(supabase.deletes("knowledge_embeddings")).toBe(1);
    const filtros = supabase.filters("knowledge_embeddings");
    expect(hasFilter(filtros, "eq", "source_type", "producto")).toBe(true);
    expect(hasFilter(filtros, "eq", "source_id", "p1")).toBe(true);
    // No se gastó una llamada al proveedor para algo que se iba a borrar.
    expect(generateEmbedding).not.toHaveBeenCalled();
  });

  it("un producto inactivo tampoco se indexa: se limpia su ficha", async () => {
    const supabase = mockSupabase({
      products: { maybeSingle: { ...productoActivo, is_active: false } },
    });

    await expect(indexKnowledgeSource("producto", "p1", supabase)).resolves.toEqual({
      indexed: false,
      reason: "fuente_no_publicable",
    });
    expect(supabase.deletes("knowledge_embeddings")).toBe(1);
    expect(supabase.upserts("knowledge_embeddings")).toEqual([]);
  });

  it("propaga el error de leer el producto", async () => {
    const supabase = mockSupabase({ products: { maybeSingle: dbError("permission denied", "42501") } });

    await expect(indexKnowledgeSource("producto", "p1", supabase)).rejects.toThrow(
      "permission denied",
    );
  });

  it("propaga el error del proveedor de embeddings sin escribir nada", async () => {
    vi.mocked(generateEmbedding).mockRejectedValue(
      new Error("HUGGINGFACEHUB_API_TOKEN no está configurada."),
    );
    const supabase = mockSupabase({ products: { maybeSingle: productoActivo } });

    await expect(indexKnowledgeSource("producto", "p1", supabase)).rejects.toThrow(
      "HUGGINGFACEHUB_API_TOKEN no está configurada.",
    );
    expect(supabase.upserts("knowledge_embeddings")).toEqual([]);
  });

  it("propaga el error del upsert", async () => {
    const supabase = mockSupabase({
      products: { maybeSingle: productoActivo },
      knowledge_embeddings: { upsert: dbError("expected 384 dimensions, not 3", "22000") },
    });

    await expect(indexKnowledgeSource("producto", "p1", supabase)).rejects.toThrow(
      "expected 384 dimensions, not 3",
    );
  });

  it("propaga el error de borrar la ficha huérfana", async () => {
    const supabase = mockSupabase({
      products: { maybeSingle: null },
      knowledge_embeddings: { delete: dbError("permission denied", "42501") },
    });

    await expect(indexKnowledgeSource("producto", "p1", supabase)).rejects.toThrow(
      "permission denied",
    );
  });
});

describe("indexKnowledgeSource — artículo de soporte", () => {
  it("usa el constructor de texto del artículo y guarda categoría en la metadata", async () => {
    const supabase = mockSupabase({ support_articles: { maybeSingle: articuloPublicado } });

    await expect(indexKnowledgeSource("articulo_soporte", "a1", supabase)).resolves.toEqual({
      indexed: true,
    });

    expect(buildSupportArticleEmbeddingText).toHaveBeenCalledWith({
      title: "Política de devoluciones",
      category: "Devoluciones",
      content: "Tienes 7 días…",
    });
    expect(supabase.upserts("knowledge_embeddings")).toEqual([
      {
        source_type: "articulo_soporte",
        source_id: "a1",
        chunk_index: 0,
        content: "TEXTO-ARTICULO",
        embedding: "[0.1,0.2,0.3]",
        metadata: { title: "Política de devoluciones", category: "Devoluciones" },
      },
    ]);
  });

  it("un artículo sin publicar se limpia igual que un producto inactivo", async () => {
    const supabase = mockSupabase({
      support_articles: { maybeSingle: { ...articuloPublicado, is_published: false } },
    });

    await expect(indexKnowledgeSource("articulo_soporte", "a1", supabase)).resolves.toEqual({
      indexed: false,
      reason: "fuente_no_publicable",
    });
    expect(supabase.deletes("knowledge_embeddings")).toBe(1);
  });

  it("un artículo inexistente devuelve fuente_no_existe", async () => {
    const supabase = mockSupabase({ support_articles: { maybeSingle: null } });

    await expect(indexKnowledgeSource("articulo_soporte", "a1", supabase)).resolves.toEqual({
      indexed: false,
      reason: "fuente_no_existe",
    });
  });

  it("propaga el error de lectura", async () => {
    const supabase = mockSupabase({ support_articles: { maybeSingle: dbError("boom") } });

    await expect(indexKnowledgeSource("articulo_soporte", "a1", supabase)).rejects.toThrow("boom");
  });
});
