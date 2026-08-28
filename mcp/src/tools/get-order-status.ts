/**
 * #10 — ADMIN obligatorio: `orders_select_*` y `order_items_select_*` conceden
 * SELECT solo al comprador dueño, al vendedor con ítems en el pedido o al
 * admin. Un anónimo no lee nada y todo pedido parecería inexistente.
 *
 * EN PRODUCCIÓN ESTO NO BASTA: cualquiera con el id vería el pedido. Un
 * despliegue real debe exigir autenticación del comprador (sesión o token de
 * seguimiento) antes de responder. Aquí es aceptable porque el servidor corre
 * local contra el seed del curso.
 *
 * LIMITACIÓN CONOCIDA (descubierta al ejercitar esta tool, sesión 5): el rol
 * `service_role` BYPASEA RLS pero eso no le da privilegios de tabla, y
 * `supabase/policies.sql` solo le concede SELECT sobre products,
 * support_articles, categories y knowledge_embeddings. Sobre `orders` responde
 * `permission denied for table orders (42501)`. Arreglarlo requiere una
 * migración con `grant select on public.orders, public.order_items to
 * service_role;` — y la sesión 5 tiene prohibido tocar migraciones, seed y
 * RLS. Hasta entonces esta tool devuelve ese error, con la sugerencia literal
 * de Postgres incluida.
 *
 * Por eso la salida se proyecta campo por campo en vez de devolver el `Order`
 * completo: `orders` incluye `buyer_id` y la dirección de envío, y ninguna
 * salida de este servidor puede llevar datos del comprador. La reutiliza el
 * agente de voz de la sesión 8.
 */
import { z } from "zod";
import { getOrderById } from "@/services/order.service";
import { createContext } from "../context";
import { notFound } from "../lib/errors";
import { safeTool } from "../lib/safe";
import { toolResult } from "../lib/tool-result";

export const getOrderStatusTool = {
  name: "get_order_status",
  config: {
    title: "Estado de un pedido",
    description:
      "¿En qué va este pedido? Devuelve el estado actual (pendiente, pagado, enviado, " +
      "entregado o cancelado), la fecha, el total y los productos que incluye con el " +
      "precio al que se compraron. No devuelve ningún dato del comprador ni dirección " +
      "de envío.",
    inputSchema: { orderId: z.string().uuid().describe("id del pedido (UUID)") },
  },
  handler: safeTool(async ({ orderId }: { orderId: string }) => {
    const { admin } = createContext();
    const order = await getOrderById(orderId, admin);
    if (!order) throw notFound("un pedido", orderId);

    return toolResult(
      {
        id: order.id,
        status: order.status,
        createdAt: order.created_at,
        total: order.total,
        currency: "PEN",
        items: order.items.map((item) => ({
          title: item.title_snapshot,
          quantity: item.quantity,
          // Snapshot: el precio al que se compró, no el precio actual.
          unitPrice: item.price_snapshot,
        })),
      },
      `Pedido ${order.id}: ${order.status}.`,
    );
  }),
};
