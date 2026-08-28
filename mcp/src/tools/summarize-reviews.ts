/**
 * #8 — anon: `reviews` es público (y el service ya anonimiza al autor como
 * "Comprador verificado"). Requiere token de Hugging Face para la completion.
 */
import { z } from "zod";
import { generateCompletion } from "@/lib/ai/completion";
import { getProductById } from "@/services/product.service";
import { listByProduct } from "@/services/review.service";
import { createContext } from "../context";
import { notFound } from "../lib/errors";
import { safeTool } from "../lib/safe";
import { toolResult } from "../lib/tool-result";

const SYSTEM_PROMPT =
  "Eres un analista de reseñas de un marketplace. Resume en español lo que dicen " +
  "los compradores de un producto: pros, contras y para quién conviene. Usa SOLO " +
  "las reseñas que te doy; si no alcanzan para afirmar algo, dilo. No inventes " +
  "especificaciones ni menciones a compradores por nombre.";

export const summarizeReviewsTool = {
  name: "summarize_reviews",
  config: {
    title: "Resumir reseñas de un producto",
    description:
      "¿Qué opinan los compradores de este producto? Lee todas sus reseñas verificadas " +
      "y devuelve un resumen con pros, contras y perfil de comprador al que le conviene, " +
      "junto al promedio y el conteo. Si el producto no tiene reseñas, lo dice sin inventar.",
    inputSchema: { productId: z.string().uuid().describe("id del producto") },
  },
  handler: safeTool(async ({ productId }: { productId: string }) => {
    const { anon } = createContext();

    const product = await getProductById(productId, anon);
    if (!product) throw notFound("un producto activo", productId);

    const reviews = await listByProduct(productId, anon);
    if (reviews.length === 0) {
      return toolResult(
        { productId, title: product.title, reviewCount: 0, summary: null },
        `"${product.title}" todavía no tiene reseñas.`,
      );
    }

    const body = reviews
      // `reviews` solo tiene rating y comment (no hay columna de título).
      .map((review) => `- (${review.rating}/5) ${review.comment ?? "(sin comentario)"}`)
      .join("\n");

    const { text, model } = await generateCompletion(
      SYSTEM_PROMPT,
      `Producto: ${product.title}\n\nReseñas:\n${body}`,
    );

    return toolResult(
      {
        productId,
        title: product.title,
        reviewCount: reviews.length,
        averageRating: product.average_rating,
        summary: text,
        model,
      },
      text,
    );
  }),
};
