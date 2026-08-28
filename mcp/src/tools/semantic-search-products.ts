/**
 * #4 — ADMIN obligatorio: la política `knowledge_embeddings_select_authenticated`
 * concede SELECT solo `to authenticated`. Con el cliente anon, `match_knowledge`
 * no ve ninguna fila y la búsqueda devolvería siempre vacío.
 * Requiere token de Hugging Face (calcula el embedding de la consulta).
 */
import { z } from "zod";
import { searchProducts } from "@/services/vector-search.service";
import { createContext } from "../context";
import { safeTool } from "../lib/safe";
import { toolResult } from "../lib/tool-result";

export const semanticSearchProductsTool = {
  name: "semantic_search_products",
  config: {
    title: "Búsqueda semántica de productos",
    description:
      "¿Qué productos encajan con esta necesidad, aunque no compartan palabras? Busca " +
      "por SIGNIFICADO, no por texto exacto: 'algo para jugar sin gastar mucho' o " +
      "'audífonos para el gimnasio' encuentran productos que no contienen esas " +
      "palabras. Devuelve cada producto con su grado de similitud (0 a 1).",
    inputSchema: {
      query: z.string().min(2).describe("La necesidad del comprador, en lenguaje natural"),
      topK: z.number().int().positive().max(20).optional().describe("Cuántos traer (default 5)"),
      similarityThreshold: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Similitud mínima; por debajo se descarta"),
    },
  },
  handler: safeTool(async (input: {
    query: string;
    topK?: number;
    similarityThreshold?: number;
  }) => {
    const { admin } = createContext();
    const results = await searchProducts(
      input.query,
      { topK: input.topK, similarityThreshold: input.similarityThreshold },
      admin,
    );
    return toolResult(
      results.map(({ product, similarity }) => ({
        id: product.id,
        title: product.title,
        price: product.price,
        condition: product.condition,
        stock: product.stock,
        similarity: Number(similarity.toFixed(4)),
      })),
      `${results.length} resultado(s) por significado.`,
    );
  }),
};
