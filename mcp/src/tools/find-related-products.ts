/**
 * #7 — ADMIN obligatorio: misma razón que #4 y #5
 * (`knowledge_embeddings_select_authenticated` es `to authenticated`).
 * Requiere token de Hugging Face.
 */
import { z } from "zod";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { getProductById, getProductsByIds } from "@/services/product.service";
import { searchByEmbedding } from "@/services/vector-search.service";
import { createContext } from "../context";
import { notFound } from "../lib/errors";
import { safeTool } from "../lib/safe";
import { toolResult } from "../lib/tool-result";

export const findRelatedProductsTool = {
  name: "find_related_products",
  config: {
    title: "Productos parecidos a uno dado",
    description:
      "¿Qué otros productos se parecen a este? El clásico 'más como este': toma un " +
      "producto, calcula el significado de su ficha y devuelve los más cercanos del " +
      "catálogo, excluyéndolo a él. Útil para ofrecer alternativas cuando algo está " +
      "sin stock o fuera de presupuesto.",
    inputSchema: {
      productId: z.string().uuid().describe("id del producto de referencia"),
      topK: z.number().int().positive().max(20).optional().describe("Cuántos traer (default 5)"),
    },
  },
  handler: safeTool(async ({ productId, topK }: { productId: string; topK?: number }) => {
    const { anon, admin } = createContext();

    const product = await getProductById(productId, anon);
    if (!product) throw notFound("un producto activo", productId);

    // Se pide uno de más porque el propio producto vendrá primero y se descarta.
    const { embedding } = await generateEmbedding(
      [product.title, product.brand, product.description].filter(Boolean).join(". "),
    );
    const matches = await searchByEmbedding(
      embedding,
      { topK: (topK ?? 5) + 1, sourceType: "producto" },
      admin,
    );

    const relatedIds = matches
      .filter((match) => match.sourceId !== productId)
      .slice(0, topK ?? 5);
    const related = await getProductsByIds(
      relatedIds.map((match) => match.sourceId),
      anon,
    );
    const byId = new Map(related.map((item) => [item.id, item]));

    return toolResult({
      reference: { id: product.id, title: product.title, price: product.price },
      related: relatedIds
        .filter((match) => byId.has(match.sourceId))
        .map((match) => ({
          id: match.sourceId,
          title: byId.get(match.sourceId)!.title,
          price: byId.get(match.sourceId)!.price,
          condition: byId.get(match.sourceId)!.condition,
          similarity: Number(match.similarity.toFixed(4)),
        })),
    });
  }),
};
