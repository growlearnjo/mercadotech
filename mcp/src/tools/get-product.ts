/** #2 — anon: producto, imágenes, reseñas y preguntas son públicos. */
import { z } from "zod";
import { createContext } from "../context";
import { safeTool } from "../lib/safe";
import { toolResult } from "../lib/tool-result";
import { getProductDetail } from "../shared/product-detail";

export const getProductTool = {
  name: "get_product",
  config: {
    title: "Detalle de un producto",
    description:
      "¿Cómo es este producto en detalle? Devuelve la ficha completa de un producto " +
      "activo por su id: descripción, precio, condición, stock, marca, modelo, " +
      "especificaciones, galería de imágenes, promedio de reseñas y las preguntas " +
      "de compradores con sus respuestas.",
    inputSchema: { productId: z.string().uuid().describe("id del producto (UUID)") },
  },
  handler: safeTool(async ({ productId }: { productId: string }) => {
    const { anon } = createContext();
    return toolResult(await getProductDetail(productId, anon));
  }),
};
