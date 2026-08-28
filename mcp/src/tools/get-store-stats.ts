/**
 * #9 — anon para el catálogo (público) + ADMIN solo para el top de vendidos:
 * `order_items_select_*` concede SELECT únicamente al comprador del pedido, al
 * vendedor de sus ítems o al admin. Sin admin el top saldría siempre vacío.
 * Solo agregados: ningún dato personal sale de aquí (decisión 4 de la spec).
 */
import { createContext } from "../context";
import { safeTool } from "../lib/safe";
import { toolResult } from "../lib/tool-result";
import { storeStats } from "../shared/stats";

export const getStoreStatsTool = {
  name: "get_store_stats",
  config: {
    title: "Estadísticas de la tienda",
    description:
      "¿Cómo es el catálogo de MercadoTech en números? Devuelve agregados: cuántas " +
      "categorías y productos activos hay, cuántos sin stock, el rango y promedio de " +
      "precios, el rating promedio y los productos más vendidos. Solo totales: no " +
      "expone ningún pedido ni comprador.",
    inputSchema: {},
  },
  handler: safeTool(async () => {
    const context = createContext();
    return toolResult(await storeStats(context.anon, context.admin));
  }),
};
