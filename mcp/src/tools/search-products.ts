/** #1 — anon: `products` es público para activos. */
import { z } from "zod";
import { listActiveProducts } from "@/services/product.service";
import { createContext } from "../context";
import { safeTool } from "../lib/safe";
import { toolResult } from "../lib/tool-result";

export const searchProductsTool = {
  name: "search_products",
  config: {
    title: "Buscar productos",
    description:
      "¿Qué productos hay que coincidan con estas palabras y filtros? Busca en el " +
      "catálogo activo por texto exacto (no por significado: para eso usa " +
      "semantic_search_products) y permite acotar por categoría, rango de precio y " +
      "condición. Devuelve resultados paginados con precio, condición, stock y rating.",
    inputSchema: {
      search: z.string().optional().describe("Palabras que deben aparecer en el título"),
      categorySlug: z.string().optional().describe("Slug de categoría, ej. 'laptops'"),
      minPrice: z.number().nonnegative().optional().describe("Precio mínimo en soles"),
      maxPrice: z.number().nonnegative().optional().describe("Precio máximo en soles"),
      condition: z
        .array(z.enum(["nuevo", "usado", "reacondicionado"]))
        .optional()
        .describe("Condiciones aceptadas; si se omite, todas"),
      page: z.number().int().positive().optional().describe("Página, 1-indexada"),
    },
  },
  handler: safeTool(async (input: {
    search?: string;
    categorySlug?: string;
    minPrice?: number;
    maxPrice?: number;
    condition?: ("nuevo" | "usado" | "reacondicionado")[];
    page?: number;
  }) => {
    const { anon } = createContext();
    const { items, total } = await listActiveProducts(input, anon);
    return toolResult(
      {
        total,
        page: input.page ?? 1,
        items: items.map((product) => ({
          id: product.id,
          title: product.title,
          price: product.price,
          currency: "PEN",
          condition: product.condition,
          stock: product.stock,
          brand: product.brand,
          rating: product.average_rating,
          reviewCount: product.review_count,
        })),
      },
      `${total} producto(s) coinciden.`,
    );
  }),
};
