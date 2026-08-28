/** #3 — anon: `categories` y `products` activos son públicos. */
import { createContext } from "../context";
import { safeTool } from "../lib/safe";
import { toolResult } from "../lib/tool-result";
import { categoriesWithCount } from "../shared/stats";

export const listCategoriesTool = {
  name: "list_categories",
  config: {
    title: "Listar categorías",
    description:
      "¿Qué categorías tiene la tienda y cuántos productos hay en cada una? Devuelve " +
      "las 8 categorías del catálogo con su slug (el que acepta search_products) y el " +
      "número de productos activos. Útil para orientarse antes de buscar.",
    inputSchema: {},
  },
  handler: safeTool(async () => {
    const { anon } = createContext();
    return toolResult(await categoriesWithCount(anon));
  }),
};
